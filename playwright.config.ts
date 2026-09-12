import { defineConfig } from '@playwright/test'

// One harness, several projects. D17: Playwright never drives the live site except for the
// read-only `smoke-deployed` project below. S0.4 adds `pwa` and S7.3 adds `e2e`, both against a
// local `vite preview` on port 4173.
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  projects: [
    {
      name: 'smoke-deployed',
      testMatch: /.*\.deployed\.spec\.ts/,
      use: {
        baseURL: process.env.SMOKE_BASE_URL ?? 'https://chris-88.github.io/phibsboro/',
      },
    },
  ],
})
