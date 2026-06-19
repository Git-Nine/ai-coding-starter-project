import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Gate a server component / route to admins only (PROJ-5).
 *
 * Three layers protect the admin area; this is the page-level one:
 *   1. Middleware bounces unauthenticated visitors to /login (PROJ-2).
 *   2. This helper redirects non-admins to /scans WITHOUT revealing the route 404/403s —
 *      we deliberately don't expose that an admin area exists (Decision Log).
 *   3. RLS on public.plants is the real boundary: only role = 'admin' may write.
 *
 * Returns the authenticated supabase client + user so the caller can reuse them.
 */
export async function requireAdmin(returnTo: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`)

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: 'user' | 'admin' }>()

  if (data?.role !== 'admin') redirect('/scans')

  return { supabase, user }
}
