import { defineConfig } from 'vitest/config'

// tests/db: structural assertions against the CLI's local Supabase stack. Separate from
// vitest.config.ts because it needs a database, runs in Node rather than jsdom, and must not
// be picked up by `npm test` on a machine without the stack. Run with `npm run test:db`.
process.env.TZ = 'UTC'

export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    environment: 'node',
    // One file at a time: they share a database.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { TZ: 'UTC' },
  },
})
