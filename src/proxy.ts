import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next.js 16 renamed "middleware" → "proxy" (file: proxy.ts, exported `proxy`
// function). See https://nextjs.org/docs/messages/middleware-to-proxy
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on all request paths except static assets and image files, so the
     * auth session is refreshed — and route protection is enforced — for every
     * page and API route the user hits.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
