import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Set before anything in this process constructs a Date. test.env applies to the
// worker, which is too late for the runner itself. Decision D53.
process.env.TZ = 'UTC'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      // tests/e2e belongs to Playwright. Vitest's default include glob matches
      // **/*.spec.ts anywhere, so without this it loads the Playwright specs and dies
      // on "Playwright Test did not expect test() to be called here". tests/db needs the
      // local Supabase stack and runs under vitest.db.config.ts (`npm run test:db`); tests/rls
      // needs the hosted project and runs under vitest.rls.config.ts (`npm run test:rls`).
      exclude: [...configDefaults.exclude, 'tests/e2e/**', 'tests/db/**', 'tests/rls/**'],
      setupFiles: ['src/test/setup.ts'],
      // Vitest stubs .css imports to an empty string by default, which also empties
      // `import css from '@/index.css?raw'`. The token contrast test reads the
      // stylesheet that way, so let the CSS through.
      css: true,
      // A clean clone has no .env. Without these, anything reading import.meta.env
      // sees undefined and `npm run test` fails on a fresh checkout (AC1).
      // Every VITE_ key in .env.example, so the unit suite is hermetic: it must pass on a
      // runner with no .env.local. S0.6 shipped a test that read VITE_SENTRY_RELEASE, passed
      // locally off .env.local, and failed CI — this block is why that cannot recur.
      env: {
        TZ: 'UTC',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-long-enough-to-parse',
        VITE_APP_BASE_URL: 'http://localhost:5173',
        VITE_BASE_PATH: '/',
        VITE_SENTRY_DSN: '',
        VITE_SENTRY_RELEASE: 'test',
        VITE_SENTRY_ENVIRONMENT: 'test',
      },
      // S7.2 AC9 — a coverage floor over the pure helpers in src/lib so the cross-cutting logic
      // (dates, share text, counts, the scrubber) cannot rot silently. Scoped to src/lib only,
      // deliberately: a global number would be meaningless or would force the component tests this
      // story does not want (D57). Enforced by the `check` CI job via `npm run test:coverage`;
      // `npm run test` stays plain and fast (AC11).
      coverage: {
        provider: 'v8',
        include: ['src/lib/**/*.ts'],
        exclude: [
          'src/lib/database.types.ts', // generated
          'src/lib/**/*.test.ts',
          'src/lib/supabase.ts', // a client constructor with nothing to assert (spec)
          'src/lib/env.ts', // the one module allowed to read import.meta.env; no branch to floor (spec)
          // S7.2 deviation: auth.ts's two live functions are thin `supabase.auth.*` wrappers, the
          // same shape as the excluded supabase.ts, and can only be reached by stubbing the client
          // — which this story forbids ("no client, no stub, no network"). Its pure `mapAuthError`
          // keeps its own S2.1 tests, which still run. Excluded so functions:100 stays honest.
          'src/lib/auth.ts',
        ],
        thresholds: { lines: 95, statements: 95, branches: 90, functions: 100 },
      },
    },
  }),
)
