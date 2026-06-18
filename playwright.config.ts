import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Make .env.local available to the test process (the seeded-auth RLS harness
// reads the Supabase URL/anon key + service-role key from it). The webServer
// loads its own env separately.
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Browser UI specs — skip the API-only RLS harness here.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /rls-isolation/ },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] }, testIgnore: /rls-isolation/ },
    // Seeded-auth RLS/storage harness — talks to Supabase directly, no browser,
    // so it runs exactly once (not per browser project).
    { name: 'rls', testMatch: /rls-isolation\.spec\.ts/ },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
