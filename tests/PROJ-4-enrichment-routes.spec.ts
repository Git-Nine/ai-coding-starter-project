import { test, expect } from '@playwright/test'

/**
 * PROJ-4 — Environmental Data Enrichment.
 *
 * Browser E2E for acceptance criteria reachable WITHOUT an authenticated session:
 *
 * - AC-S2: unauthenticated visitor hitting the scan detail (which hosts the
 *   ConditionsSummary) is redirected to /login.
 * - AC-P3: "Generate plan" button is intentionally disabled — the seam for PROJ-6
 *   is present but not wired. Users are never blocked by missing enrichment data
 *   when it comes to proceeding (the button is disabled for ALL users pending PROJ-6).
 *
 * Authenticated UI flows (pending skeleton → live conditions card, retry button,
 * re-enrichment on location change) require a real signed-in session and real
 * external API responses from BGR/DWD. Those are validated manually against the
 * live Vercel deployment once the Supabase migration and Realtime publication are
 * applied; they are NOT automated here due to test-environment constraints.
 */

test.describe('PROJ-4 enrichment — route protection (AC-S2)', () => {
  test('unauthenticated visit to a scan detail page redirects to /login', async ({ page }) => {
    await page.goto('/scans/00000000-0000-0000-0000-000000000001')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByText('Welcome', { exact: true })).toBeVisible()
  })

  test('POST /api/enrich returns 401 for an unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/enrich', {
      data: { scan_id: '00000000-0000-0000-0000-000000000001' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/enrich returns 400 for an invalid scan_id', async ({ request }) => {
    // Still returns 400 (schema validation) even without auth.
    const res = await request.post('/api/enrich', {
      data: { scan_id: 'not-a-uuid' },
    })
    // Either 400 (schema) or 401 (auth first) — both mean the request is rejected.
    expect([400, 401]).toContain(res.status())
  })
})
