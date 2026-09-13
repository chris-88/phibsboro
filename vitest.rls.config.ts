import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// tests/rls: the S1.4 security gate. Real sign-ins as every role against the hosted project,
// which globalSetup wipes and reseeds first (D63). Separate from vitest.config.ts so `npm test`
// stays fast and offline, and from vitest.db.config.ts because this suite is hosted-only:
// credentials come from the environment (CI's `db` job) or .env.local (tests/helpers/target.ts).
process.env.TZ = 'UTC' // D53
process.env.PFC_DB_TARGET = 'hosted'

export default defineConfig({
  // The S1.5 hook test imports src/api, which imports through the alias.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/rls/**/*.test.ts'],
    globalSetup: ['tests/rls/globalSetup.ts'],
    environment: 'node',
    // One database, one writer at a time (AC12).
    fileParallelism: false,
    testTimeout: 20_000,
    // afterAll hooks delete throwaway auth users; each admin call is a round trip to London.
    hookTimeout: 60_000,
    // src/lib/env.ts also needs a base URL; the hosted URL and anon key come from the
    // environment or .env.local, the same way tests/helpers/target.ts reads them.
    env: { TZ: 'UTC', PFC_DB_TARGET: 'hosted', VITE_APP_BASE_URL: 'https://app.phibsboro.ie' },
  },
})
