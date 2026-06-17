import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from './env'

/**
 * Privileged Supabase client using the service-role key. BYPASSES Row Level
 * Security, so it must ONLY be imported from server-side code (route handlers /
 * server actions) — never from a Client Component.
 *
 * The key lives in `SUPABASE_SERVICE_ROLE_KEY` (no NEXT_PUBLIC_ prefix), so it
 * is never inlined into the browser bundle; any accidental client import would
 * throw below because the var is undefined client-side. Currently used solely by
 * the delete-account route, which needs `auth.admin.deleteUser`.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getSupabaseEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set — required for privileged server operations (account deletion). Set it in .env.local (never with a NEXT_PUBLIC_ prefix).',
    )
  }

  return createClient(NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
