import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * PROJ-2 — two-account runtime verification of the carried-forward PROJ-1
 * security ACs (AC-3/5/6/7/8 + the role-escalation guard), which until now were
 * only proven by code/unit/route review. This harness exercises them end-to-end
 * against the LIVE Supabase project with two real signed-in accounts:
 *
 *   1. seed two users via the admin API (createUser fires handle_new_user → a
 *      profile row with role='user');
 *   2. mint a real session for each through the OTP path the app itself uses
 *      (admin.generateLink → verifyOtp) — no browser, no email delivery;
 *   3. assert each user can only ever touch their own row + storage namespace;
 *   4. delete both users in afterAll (cascades profile rows + storage files).
 *
 * Runs in its own browser-less Playwright project ("rls") so it executes once.
 * Skips cleanly when the Supabase env (incl. the service-role key) is absent.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ready = Boolean(url && anonKey && serviceKey)

const BUCKET = 'photos'
const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

type SeededUser = { id: string; email: string; client: SupabaseClient }

test.describe('PROJ-2 cross-account RLS + storage isolation (two real accounts)', () => {
  // Stateful + shares two seeded accounts across tests → run serially in one
  // worker so beforeAll seeds exactly once (avoids duplicate-email collisions
  // when fullyParallel would otherwise re-invoke it per worker batch).
  test.describe.configure({ mode: 'serial' })
  test.skip(!ready, 'Set NEXT_PUBLIC_SUPABASE_URL/ANON_KEY + SUPABASE_SERVICE_ROLE_KEY in .env.local to run')

  let admin: SupabaseClient
  let a: SeededUser
  let b: SeededUser

  async function seed(label: string): Promise<SeededUser> {
    const email = `proj2.rls.${stamp}.${label}@example.com`
    // Confirmed user → fires the auto-provisioning trigger.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
    })
    if (createErr || !created.user) throw createErr ?? new Error('createUser returned no user')

    // Mint a real session via the same OTP verify the login form uses.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkErr) throw linkErr
    const otp = link.properties?.email_otp
    if (!otp) throw new Error('generateLink returned no email_otp')

    const client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: verified, error: otpErr } = await client.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    })
    if (otpErr || !verified.session) throw otpErr ?? new Error('verifyOtp returned no session')

    return { id: created.user.id, email, client }
  }

  // Delete every test account this harness ever creates (by email prefix).
  // Self-healing: clears stragglers from an interrupted prior run, and is the
  // teardown. Deleting an auth user cascades its profile row (FK) + storage
  // files (on_auth_user_deleted trigger).
  async function purgeTestUsers() {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
    const stale = (data?.users ?? []).filter((u) => u.email?.startsWith('proj2.rls.'))
    for (const u of stale) await admin.auth.admin.deleteUser(u.id)
  }

  test.beforeAll(async () => {
    if (!ready) return
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await purgeTestUsers()
    a = await seed('a')
    b = await seed('b')
  })

  test.afterAll(async () => {
    if (!ready) return
    await purgeTestUsers()
  })

  test('AC-3: first sign-in auto-provisions a profile row with role="user"', async () => {
    const { data, error } = await a.client.from('users').select('id, role').eq('id', a.id).single()
    expect(error).toBeNull()
    expect(data?.id).toBe(a.id)
    expect(data?.role).toBe('user')
  })

  test('AC-5: a user reads only their own profile row', async () => {
    // Unfiltered select returns only the caller's row under owner-only RLS.
    const { data, error } = await a.client.from('users').select('id')
    expect(error).toBeNull()
    expect(data?.map((r) => r.id)).toEqual([a.id])

    // B's row is invisible to A even when targeted directly.
    const { data: bRow } = await a.client.from('users').select('id').eq('id', b.id)
    expect(bRow).toEqual([])
  })

  test('profile happy-path: a user can update and read back their own row', async () => {
    // Positive control — also guards the grant fix (BUG-7 broke authenticated UPDATE).
    const { error: updErr } = await a.client
      .from('users')
      .update({ display_name: 'My Garden', maintenance_preference: 'low' })
      .eq('id', a.id)
    expect(updErr).toBeNull()

    const { data, error } = await a.client
      .from('users')
      .select('display_name, maintenance_preference')
      .eq('id', a.id)
      .single()
    expect(error).toBeNull()
    expect(data?.display_name).toBe('My Garden')
    expect(data?.maintenance_preference).toBe('low')
  })

  test('AC-6: a user cannot modify another user’s profile', async () => {
    await a.client.from('users').update({ display_name: 'hacked-by-a' }).eq('id', b.id)
    // Confirm from B's own session that nothing changed.
    const { data } = await b.client.from('users').select('display_name').eq('id', b.id).single()
    expect(data?.display_name).not.toBe('hacked-by-a')
  })

  test('role-escalation guard: a user cannot promote themselves to admin', async () => {
    await a.client.from('users').update({ role: 'admin' }).eq('id', a.id)
    // Read back via the service role (bypasses RLS) — the trigger must have reverted it.
    const { data } = await admin.from('users').select('role').eq('id', a.id).single()
    expect(data?.role).toBe('user')
  })

  test('AC-7/8: storage is isolated to each user’s namespace', async () => {
    const file = new Blob(['rls-probe'], { type: 'text/plain' })
    const ownPath = `${a.id}/rls-probe.txt`
    const crossPath = `${b.id}/rls-probe.txt`

    // A can write within its own /{a.id}/ folder.
    const { error: ownErr } = await a.client.storage
      .from(BUCKET)
      .upload(ownPath, file, { upsert: true })
    expect(ownErr).toBeNull()

    // A cannot write into B's folder.
    const { error: crossWriteErr } = await a.client.storage
      .from(BUCKET)
      .upload(crossPath, file, { upsert: true })
    expect(crossWriteErr).not.toBeNull()

    // B cannot read A's file.
    const { data: dl, error: crossReadErr } = await b.client.storage.from(BUCKET).download(ownPath)
    expect(dl).toBeNull()
    expect(crossReadErr).not.toBeNull()

    // Tidy up A's probe (deleteUser would also cascade it).
    await a.client.storage.from(BUCKET).remove([ownPath])
  })
})
