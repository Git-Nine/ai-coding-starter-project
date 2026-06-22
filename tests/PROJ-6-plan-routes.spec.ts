import { test, expect } from '@playwright/test'

/**
 * PROJ-6 — Rule-Based Plan Generation.
 *
 * Browser E2E for the access-control AC reachable WITHOUT a real session: an
 * unauthenticated visitor to the read-only plan view must be redirected to /login
 * (PROJ-2's middleware gate) with the original path preserved in returnTo.
 *
 * The authenticated generation/view UI flows need a real session and are NOT
 * covered here (consistent with PROJ-3/5). The data-layer security ACs — owner-only
 * plans/plan_plants and the admin-only reassignment — are proven against two real
 * accounts in PROJ-6-plans-rls-isolation.spec.ts (the browser-less `rls` project).
 */

test.describe('PROJ-6 plan route — route protection (middleware)', () => {
  test('unauthenticated visit to a plan view redirects to /login with returnTo', async ({ page }) => {
    await page.goto('/scans/00000000-0000-0000-0000-000000000000/plan')
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fscans%2F.*%2Fplan/)
  })
})
