import { defineConfig } from 'vitest/config'

// tests/db: assertions against a real Supabase stack. Separate from vitest.config.ts because it
// needs a database, runs in Node rather than jsdom, and must not be picked up by `npm test` on a
// machine without the stack. `npm run test:db` targets the CLI's local stack; `npm run
// test:db:hosted` sets PFC_DB_TARGET=hosted and the helpers read .env.local (tests/helpers/target.ts).
process.env.TZ = 'UTC'

const hosted = process.env.PFC_DB_TARGET === 'hosted'

export default defineConfig({
  test: {
    include: ['tests/db/**/*.test.ts'],
    // schema.test.ts opens a direct Postgres connection, which the hosted project does not
    // expose; it runs against the local stack only (CI's db job).
    exclude: hosted ? ['tests/db/schema.test.ts'] : [],
    environment: 'node',
    // One file at a time: they share a database.
    fileParallelism: false,
    testTimeout: 30_000,
    // seed.test.ts reseeds in beforeAll: 25 admin createUser calls, slower against the hosted project.
    hookTimeout: 120_000,
    env: { TZ: 'UTC' },
  },
})
