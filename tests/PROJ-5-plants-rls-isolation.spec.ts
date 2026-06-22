import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * PROJ-5 — runtime verification of the plant-catalogue security ACs against two
 * real accounts: an ADMIN (role = 'admin') and a regular USER. Mirrors the PROJ-3
 * RLS harness. Proves the PRD constraint end-to-end:
 *   - every authenticated user may READ the catalogue;
 *   - only an admin may INSERT / UPDATE / DELETE — a non-admin is blocked by RLS
 *     at the database, not merely by the UI;
 *   - latin_name is unique (duplicate insert rejected);
 *   - the seed is idempotent and never clobbers an admin edit (ON CONFLICT DO NOTHING).
 *
 * Runs in the browser-less `rls` Playwright project. Skips cleanly without the
 * Supabase env (incl. service-role key). Promotes the admin account via the
 * service-role client, whose privileged context bypasses the role-escalation guard.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ready = Boolean(url && anonKey && serviceKey)

const EMAIL_PREFIX = 'proj5.plants.'
const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
// Namespaced Latin names so the harness never collides with the real seeded catalogue.
const LATIN = (n: number) => `ZZ-QA-${stamp}-${n}`

type SeededUser = { id: string; client: SupabaseClient }

function newPlant(latin: string, overrides: Record<string, unknown> = {}) {
  return {
    common_name: 'QA Testpflanze',
    latin_name: latin,
    sun_tolerance: ['full'],
    soil_compatibility: ['loam'],
    min_hardiness_zone: 6,
    mature_height_cm: 50,
    mature_spread_cm: 40,
    maintenance_level: 'low',
    plant_type: 'perennial', // required since PROJ-6
    native: false,
    ...overrides,
  }
}

test.describe('PROJ-5 plant catalogue — admin-only writes, all-read (two real accounts)', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!ready, 'Set NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY in .env.local to run')

  let admin: SupabaseClient
  let adminUser: SeededUser
  let regularUser: SeededUser

  async function purgeTestUsers() {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
    const stale = (data?.users ?? []).filter((u) => u.email?.startsWith(EMAIL_PREFIX))
    for (const u of stale) await admin.auth.admin.deleteUser(u.id)
  }

  async function purgeTestPlants() {
    // Plants have no user FK, so they survive user deletion — remove them explicitly.
    await admin.from('plants').delete().like('latin_name', `ZZ-QA-${stamp}-%`)
  }

  async function seed(label: string): Promise<SeededUser> {
    const email = `${EMAIL_PREFIX}${stamp}.${label}@example.com`
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createErr || !created.user) throw createErr ?? new Error('createUser returned no user')
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkErr) throw linkErr
    const otp = link.properties?.email_otp
    if (!otp) throw new Error('generateLink returned no email_otp')
    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: verified, error: otpErr } = await client.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (otpErr || !verified.session) throw otpErr ?? new Error('verifyOtp returned no session')
    return { id: created.user.id, client }
  }

  test.beforeAll(async () => {
    if (!ready) return
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } })
    await purgeTestUsers()
    await purgeTestPlants()
    adminUser = await seed('admin')
    regularUser = await seed('user')
    // Promote the admin account (privileged context → role-escalation guard allows it).
    const { error } = await admin.from('users').update({ role: 'admin' }).eq('id', adminUser.id)
    if (error) throw error
  })

  test.afterAll(async () => {
    if (!ready) return
    await purgeTestPlants()
    await purgeTestUsers()
  })

  test('the admin promotion took effect', async () => {
    const { data } = await admin.from('users').select('role').eq('id', adminUser.id).single()
    expect(data?.role).toBe('admin')
  })

  test('AC: an admin can insert a plant', async () => {
    const { error } = await adminUser.client.from('plants').insert(newPlant(LATIN(1), { common_name: 'Admin Plant' }))
    expect(error).toBeNull()
    const { data } = await adminUser.client.from('plants').select('common_name').eq('latin_name', LATIN(1)).single()
    expect(data?.common_name).toBe('Admin Plant')
  })

  test('AC: a regular user can READ the catalogue (incl. the admin-created plant)', async () => {
    const { data, error } = await regularUser.client.from('plants').select('latin_name').eq('latin_name', LATIN(1))
    expect(error).toBeNull()
    expect(data?.map((r) => r.latin_name)).toContain(LATIN(1))
  })

  test('AC-security: a regular user CANNOT insert a plant (RLS blocks at the DB)', async () => {
    const { error } = await regularUser.client.from('plants').insert(newPlant(LATIN(99), { common_name: 'Sneaky' }))
    expect(error).not.toBeNull()
    // And nothing was written.
    const { data } = await adminUser.client.from('plants').select('id').eq('latin_name', LATIN(99))
    expect(data).toEqual([])
  })

  test('AC-security: a regular user CANNOT update a plant', async () => {
    await regularUser.client.from('plants').update({ common_name: 'Hacked' }).eq('latin_name', LATIN(1))
    const { data } = await adminUser.client.from('plants').select('common_name').eq('latin_name', LATIN(1)).single()
    expect(data?.common_name).toBe('Admin Plant')
  })

  test('AC-security: a regular user CANNOT delete a plant', async () => {
    await regularUser.client.from('plants').delete().eq('latin_name', LATIN(1))
    const { data } = await adminUser.client.from('plants').select('latin_name').eq('latin_name', LATIN(1))
    expect(data?.map((r) => r.latin_name)).toEqual([LATIN(1)])
  })

  test('AC: latin_name is unique — a duplicate insert is rejected', async () => {
    const { error } = await adminUser.client.from('plants').insert(newPlant(LATIN(1), { common_name: 'Dupe' }))
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
  })

  test('AC: the seed is idempotent and never clobbers an admin edit', async () => {
    // 1) seed inserts the plant
    await admin.from('plants').upsert([newPlant(LATIN(2), { maintenance_level: 'low' })], {
      onConflict: 'latin_name',
      ignoreDuplicates: true,
    })
    // 2) an admin edits it
    await adminUser.client.from('plants').update({ maintenance_level: 'high' }).eq('latin_name', LATIN(2))
    // 3) the seed runs again — ON CONFLICT DO NOTHING must preserve the edit
    const { data: reinserted } = await admin
      .from('plants')
      .upsert([newPlant(LATIN(2), { maintenance_level: 'low' })], { onConflict: 'latin_name', ignoreDuplicates: true })
      .select('latin_name')
    expect(reinserted ?? []).toEqual([]) // conflict → nothing inserted

    const { data } = await admin.from('plants').select('maintenance_level').eq('latin_name', LATIN(2)).single()
    expect(data?.maintenance_level).toBe('high') // edit preserved, not reset to 'low'
  })

  test('AC: an admin can update and delete their plant', async () => {
    const { error: updErr } = await adminUser.client
      .from('plants')
      .update({ maintenance_level: 'medium' })
      .eq('latin_name', LATIN(1))
    expect(updErr).toBeNull()
    const { data: upd } = await adminUser.client.from('plants').select('maintenance_level').eq('latin_name', LATIN(1)).single()
    expect(upd?.maintenance_level).toBe('medium')

    const { error: delErr } = await adminUser.client.from('plants').delete().eq('latin_name', LATIN(1))
    expect(delErr).toBeNull()
    const { data: gone } = await adminUser.client.from('plants').select('id').eq('latin_name', LATIN(1))
    expect(gone).toEqual([])
  })
})
