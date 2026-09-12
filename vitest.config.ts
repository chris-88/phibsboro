import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Set before anything in this process constructs a Date. test.env applies to the
// worker, which is too late for the runner itself. Decision D53.
process.env.TZ = 'UTC'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      // S0.2 switches this to 'jsdom' when Testing Library arrives.
      environment: 'node',
      // A clean clone has no .env. Without these, anything reading import.meta.env
      // sees undefined and `npm run test` fails on a fresh checkout (AC1).
      env: {
        TZ: 'UTC',
        VITE_APP_BASE_URL: 'http://localhost:5173',
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SENTRY_DSN: '',
      },
    },
  }),
)
