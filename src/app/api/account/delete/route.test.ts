import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the two Supabase clients the route depends on.
const getUser = vi.fn()
const deleteUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { deleteUser } },
  })),
}))

import { POST } from './route'

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    getUser.mockReset()
    deleteUser.mockReset()
  })

  it('deletes the account for an authenticated user (happy path)', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    deleteUser.mockResolvedValue({ error: null })

    const res = await POST()

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })
    expect(deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('returns 401 when there is no session (auth check)', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const res = await POST()

    expect(res.status).toBe(401)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('uses the caller session id, never a client-supplied id', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'real-caller' } } })
    deleteUser.mockResolvedValue({ error: null })

    await POST()

    // The id passed to the admin delete comes from the verified session only.
    expect(deleteUser).toHaveBeenCalledWith('real-caller')
  })

  it('returns 500 when the privileged delete fails', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    deleteUser.mockResolvedValue({ error: { message: 'boom' } })

    const res = await POST()

    expect(res.status).toBe(500)
  })
})
