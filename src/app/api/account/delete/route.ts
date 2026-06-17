import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Permanently delete the currently-authenticated user's account.
 *
 * Deleting an auth user requires the service-role key, so this is the single
 * place that key is used. Removing the auth.users row triggers PROJ-1's cascade:
 *   - the public.users profile row is dropped via the FK ON DELETE CASCADE
 *   - the on_auth_user_deleted trigger wipes the user's files in the photos bucket
 *
 * The client signs out and redirects after a successful response.
 */
export async function POST() {
  // Identify the caller from their session cookie — never trust a client-supplied id.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json(
      { error: 'Could not delete your account. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
