import { defineConfig } from '@playwright/test'

// One harness, several projects. D17: Playwright never drives the live site except for the
// read-only `smoke-deployed` project below. `pwa` (S0.4) and `e2e` (S7.3) run against a local
// `vite preview` on port 4173.
const PREVIEW_URL = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // The pwa specs swap the contents of dist/ under the preview server; two workers would
  // watch each other's builds appear. The smoke project is small enough not to care.
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  // The deploy smoke job sets SMOKE_BASE_URL and drives the live origin; it must not start
  // a local server. Everything else previews dist/.
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: 'npm run preview',
        url: PREVIEW_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
  projects: [
    {
      name: 'smoke-deployed',
      testMatch: /.*\.deployed\.spec\.ts/,
      use: {
        baseURL: process.env.SMOKE_BASE_URL ?? 'https://chris-88.github.io/phibsboro/',
      },
    },
    {
      name: 'pwa',
      testMatch: /pwa-.*\.spec\.ts/,
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin' }, // D53
    },
    // S2.9: sign in the seeded player and manager once, then run the guard journeys with those
    // stored sessions. Needs a seeded database (the preview build's Supabase), not Docker.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { baseURL: PREVIEW_URL },
    },
    {
      name: 'auth-guard',
      testMatch: /auth-guard\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin' },
    },
    // S2.6: the boot gate. A stored session must restore with no flash of the sign-in screen.
    {
      name: 'session',
      testMatch: /session\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin' },
    },
  ],
})
