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
    // S2.5: the deep-link return path. A brand-new user registers through an event link and lands
    // back on that event. Registers fresh accounts against the seeded stack, so it needs no stored
    // session and no `setup` dependency — a clean context per test is the point (D58).
    {
      name: 'e2e',
      testMatch: /deep-link\.spec\.ts/,
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin', browserName: 'chromium' }, // D53
    },
    // AC19: the WhatsApp iOS webview is WebKit, and no CI browser is a real webview, so WebKit is
    // the closest automatable proxy. Same specs, second engine.
    {
      name: 'e2e-webkit',
      testMatch: /deep-link\.spec\.ts/,
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin', browserName: 'webkit' },
    },
    // S3.4: the seeded player switches an answer and meets the shut-window states. Uses the stored
    // player session from `setup`, so it depends on it and needs a seeded database, not Docker.
    {
      name: 'change-response',
      testMatch: /change-response\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin' }, // D53
    },
    // S4.4: the seeded manager opens an event and reads the awaiting-first response list at 375px.
    // Uses the stored manager session from `setup`, so it depends on it and needs a seeded
    // database, not Docker.
    {
      name: 'response-list',
      testMatch: /response-list\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin' }, // D53
    },
    // S2.7, D46: the WhatsApp-webview leg. The stored player session opens an event inside a
    // simulated iOS WhatsApp webview and meets the escape prompt after responding. The spec sets
    // its own iOS user agent; clipboard permissions are granted so the copied value can be read
    // back. Chromium, so navigator.clipboard.readText is available.
    {
      name: 'escape-prompt',
      testMatch: /escape-prompt\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin', browserName: 'chromium' },
    },
    // S2.8, D46: the non-webview leg. The stored player session opens an event on a mobile Chrome
    // context, meets the Install card and never the escape prompt, and installs. The spec injects a
    // synthetic beforeinstallprompt; Chromium, so the event and evaluate hooks are available.
    {
      name: 'install-guide',
      testMatch: /install-guide\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin', browserName: 'chromium' },
    },
    // S7.3: the full MVP journey, one linear test, two contexts. It signs the manager in through
    // the UI and registers a brand-new player, so it takes no stored session and no `setup`
    // dependency — a clean context per run is the point (D58). Chromium; the Android-Chrome leg for
    // the install guide is set on the player context inside the spec. Deferred behind
    // RUN_LOCAL_STACK with the other e2e projects.
    {
      name: 'journey',
      testMatch: /journey\.spec\.ts/,
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin', browserName: 'chromium' }, // D53
    },
    // S4.6: the seeded manager generates a twelve-week training series, then cancels one occurrence
    // and leaves the rest. Uses the stored manager session from `setup`; needs the seeded database.
    {
      name: 'recurring-training',
      testMatch: /recurring-training\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: PREVIEW_URL, timezoneId: 'Europe/Dublin' }, // D53
    },
    // S7.1 AC9: the 375x667 layout sweep — no horizontal scroll, no interactive element under 44px
    // on every route. Uses the stored manager session so the manage routes render populated; needs
    // the seeded database, not Docker. Deferred behind RUN_LOCAL_STACK with the other e2e projects.
    {
      name: 'layout',
      testMatch: /layout\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        baseURL: PREVIEW_URL,
        timezoneId: 'Europe/Dublin',
        viewport: { width: 375, height: 667 },
      },
    },
  ],
})
