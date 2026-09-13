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
      // on "Playwright Test did not expect test() to be called here".
      exclude: [...configDefaults.exclude, 'tests/e2e/**'],
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
        VITE_SUPABASE_ANON_KEY: 'test-anon-key',
        VITE_APP_BASE_URL: 'http://localhost:5173',
        VITE_BASE_PATH: '/',
        VITE_SENTRY_DSN: '',
        VITE_SENTRY_RELEASE: 'test',
        VITE_SENTRY_ENVIRONMENT: 'test',
      },
    },
  }),
)
