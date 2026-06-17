import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const exchangeCodeForSession = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession },
  })),
}))

import { GET } from './route'

const ORIGIN = 'http://localhost:3000'

function request(path: string) {
  return new NextRequest(`${ORIGIN}${path}`)
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset()
  })

  it('exchanges a valid code and redirects to returnTo', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const res = await GET(request('/auth/callback?code=abc&returnTo=/profile'))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${ORIGIN}/profile`)
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
  })

  it('defaults to home when no returnTo is given', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const res = await GET(request('/auth/callback?code=abc'))

    expect(res.headers.get('location')).toBe(`${ORIGIN}/`)
  })

  it('rejects an external returnTo (open-redirect guard) → home', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null })

    const res = await GET(request('/auth/callback?code=abc&returnTo=https://evil.com'))

    expect(res.headers.get('location')).toBe(`${ORIGIN}/`)
  })

  it('redirects to /login with an error flag when the code is invalid/expired', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { message: 'expired' } })

    const res = await GET(request('/auth/callback?code=stale&returnTo=/profile'))

    const location = res.headers.get('location') ?? ''
    expect(location).toContain('/login')
    expect(location).toContain('error=link_invalid')
    expect(location).toContain('returnTo=%2Fprofile')
  })

  it('redirects to /login with an error flag when no code is present', async () => {
    const res = await GET(request('/auth/callback'))

    expect(res.headers.get('location')).toContain('error=link_invalid')
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })
})
