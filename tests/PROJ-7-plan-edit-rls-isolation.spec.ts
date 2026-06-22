import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

/**
 * PROJ-7 — runtime verification of plan EDITING against two real accounts:
 *   - an owner can persist edits to their own plan lines, including the new
 *     `pinned` flag (insert / read-back / update / remove);
 *   - the editor's "save = replace all lines" pattern works (delete-all + insert);
 *   - owner-only RLS still holds: user B cannot read, insert, update or delete
 *     user A's plan lines, and cannot flip A's `pinned`.
 *
 * Runs in the browser-less `rls` project. Skips cleanly without the Supabase env.
 * The interactive editing UI (stepper / add / remove) is validated by code review +
 * the pure-helper unit tests (src/lib/plan-edit.test.ts); this proves the data layer.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ready = Boolean(url && anonKey && serviceKey)

const EMAIL_PREFIX = 'proj7.edit.'
const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const LATIN = (n: number) => `ZZ-QA7-${stamp}-${n}`

type SeededUser = { id: string; client: SupabaseClient }

function newScan(userId: string) {
  const id = randomUUID()
  return {
    id,
    user_id: userId,
    photo_path: `${userId}/scans/${id}/photo`,
    postcode: '09123',
    sun_exposure: 'full',
    surface: 'soil',
    space_type: 'back_garden',
    area_sqm: 30,
  }
}
function newPlan(scanId: string, userId: string) {
  return {
    id: randomUUID(),
    scan_id: scanId,
    user_id: userId,
    snapshot_sun: 'full',
    snapshot_area_sqm: 30,
    snapshot_surface: 'soil',
    snapshot_space_type: 'back_garden',
    snapshot_soil: 'loam',
    snapshot_zone: 7,
    snapshot_maintenance: null,
    zone_unconfirmed: false,
    extra_match_count: 0,
  }
}
function newPlant(latin: string) {
  return {
    common_name: 'QA7 Testpflanze',
    latin_name: latin,
    sun_tolerance: ['full'],
    soil_compatibility: ['loam'],
    min_hardiness_zone: 6,
    mature_height_cm: 50,
    mature_spread_cm: 40,
    maintenance_level: 'low',
    plant_type: 'perennial',
    native: false,
  }
}

test.describe('PROJ-7 plan editing — owner-only edits + pinned persistence (two real accounts)', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!ready, 'Set NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY in .env.local to run')

  let admin: SupabaseClient
  let owner: SeededUser
  let other: SeededUser
  let scanId: string
  let planId: string
  let plantA: string
  let plantB: string

  async function purgeUsers() {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
    const stale = (data?.users ?? []).filter((u) => u.email?.startsWith(EMAIL_PREFIX))
    for (const u of stale) await admin.auth.admin.deleteUser(u.id)
  }
  async function purgePlants() {
    await admin.from('plants').delete().like('latin_name', 'ZZ-QA7-%')
  }
  async function seed(label: string): Promise<SeededUser> {
    const email = `${EMAIL_PREFIX}${stamp}.${label}@example.com`
    const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
    if (cErr || !created.user) throw cErr ?? new Error('createUser failed')
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (lErr) throw lErr
    const otp = link.properties?.email_otp
    if (!otp) throw new Error('no otp')
    const client = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: v, error: vErr } = await client.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (vErr || !v.session) throw vErr ?? new Error('verifyOtp failed')
    return { id: created.user.id, client }
  }

  test.beforeAll(async () => {
    if (!ready) return
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
    await purgeUsers()
    await purgePlants()
    owner = await seed('owner')
    other = await seed('other')

    const { data: plants, error: pErr } = await admin
      .from('plants')
      .insert([newPlant(LATIN(1)), newPlant(LATIN(2))])
      .select('id, latin_name')
    if (pErr || !plants) throw pErr ?? new Error('plant seed failed')
    plantA = plants.find((p) => p.latin_name === LATIN(1))!.id
    plantB = plants.find((p) => p.latin_name === LATIN(2))!.id

    const scan = newScan(owner.id)
    scanId = scan.id
    const { error: sErr } = await owner.client.from('scans').insert(scan)
    if (sErr) throw sErr
    const plan = newPlan(scanId, owner.id)
    planId = plan.id
    const { error: plErr } = await owner.client.from('plans').insert(plan)
    if (plErr) throw plErr
  })

  test.afterAll(async () => {
    if (!ready) return
    await purgeUsers() // cascades scans → plans → plan_plants
    await purgePlants()
  })

  test('owner can insert plan lines including a pinned one', async () => {
    const { error } = await owner.client.from('plan_plants').insert([
      { plan_id: planId, plant_id: plantA, quantity: 5, sort_order: 0, soil_flag: false, pinned: false },
      { plan_id: planId, plant_id: plantB, quantity: 9, sort_order: 1, soil_flag: false, pinned: true },
    ])
    expect(error).toBeNull()
  })

  test('the pinned flag and quantity round-trip', async () => {
    const { data } = await owner.client
      .from('plan_plants')
      .select('plant_id, quantity, pinned')
      .eq('plan_id', planId)
      .order('sort_order')
    const b = data?.find((r) => r.plant_id === plantB)
    expect(b?.pinned).toBe(true)
    expect(b?.quantity).toBe(9)
  })

  test('owner can update a line (rebalance / stepper persistence)', async () => {
    const { error } = await owner.client
      .from('plan_plants')
      .update({ quantity: 12, pinned: true })
      .eq('plan_id', planId)
      .eq('plant_id', plantA)
    expect(error).toBeNull()
    const { data } = await owner.client
      .from('plan_plants')
      .select('quantity, pinned')
      .eq('plan_id', planId)
      .eq('plant_id', plantA)
      .single()
    expect(data?.quantity).toBe(12)
    expect(data?.pinned).toBe(true)
  })

  test('the editor "replace all lines" save works (delete-all + re-insert)', async () => {
    const { error: delErr } = await owner.client.from('plan_plants').delete().eq('plan_id', planId)
    expect(delErr).toBeNull()
    const { error: insErr } = await owner.client.from('plan_plants').insert([
      { plan_id: planId, plant_id: plantA, quantity: 4, sort_order: 0, soil_flag: false, pinned: false },
    ])
    expect(insErr).toBeNull()
    const { data } = await owner.client.from('plan_plants').select('plant_id').eq('plan_id', planId)
    expect(data?.map((r) => r.plant_id)).toEqual([plantA])
  })

  test('AC-security: user B cannot read user A’s plan lines', async () => {
    const { data } = await other.client.from('plan_plants').select('id').eq('plan_id', planId)
    expect(data ?? []).toEqual([])
  })

  test('AC-security: user B cannot insert a line into user A’s plan', async () => {
    const { error } = await other.client
      .from('plan_plants')
      .insert({ plan_id: planId, plant_id: plantB, quantity: 1, sort_order: 9, soil_flag: false, pinned: true })
    expect(error).not.toBeNull()
  })

  test('AC-security: user B cannot update or delete user A’s plan lines', async () => {
    await other.client.from('plan_plants').update({ quantity: 999, pinned: true }).eq('plan_id', planId)
    await other.client.from('plan_plants').delete().eq('plan_id', planId)
    // Verified by the owner: the line is intact.
    const { data } = await owner.client
      .from('plan_plants')
      .select('quantity, pinned')
      .eq('plan_id', planId)
      .eq('plant_id', plantA)
      .single()
    expect(data?.quantity).toBe(4)
    expect(data?.pinned).toBe(false)
  })
})
