import { test, expect } from '@playwright/test'

/**
 * PROJ-5 — Plant Database & Admin Interface.
 *
 * Browser E2E for the access-control acceptance criteria reachable WITHOUT a real
 * authenticated session: an unauthenticated visitor must be redirected to /login
 * (PROJ-2's middleware gate) for every admin route, with the original path
 * preserved in returnTo.
 *
 * The role-based redirect (logged-in NON-admin → /scans) and the authenticated
 * admin UI flows (list/search/filter, add/edit, delete-with-replacement) require a
 * real session and are NOT covered here. The data-layer security AC that actually
 * matters — only admins may write the catalogue — is proven against two real
 * accounts in PROJ-5-plants-rls-isolation.spec.ts (the browser-less `rls` project).
 */

test.describe('PROJ-5 admin routes — route protection (middleware)', () => {
  test('unauthenticated visit to /admin/plants redirects to /login with returnTo', async ({ page }) => {
    await page.goto('/admin/plants')
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin%2Fplants/)
  })

  test('unauthenticated visit to /admin/plants/new redirects to /login with returnTo', async ({ page }) => {
    await page.goto('/admin/plants/new')
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin%2Fplants%2Fnew/)
  })

  test('unauthenticated visit to an edit route redirects to /login with returnTo', async ({ page }) => {
    await page.goto('/admin/plants/00000000-0000-0000-0000-000000000000/edit')
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin%2Fplants%2F/)
  })
})
