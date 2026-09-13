import { z } from 'zod'

/**
 * The environment, parsed once at module load. Everything in `src/` reads `env`, never
 * `import.meta.env`; the one exception is `src/lib/sentry.ts`, which must initialise before this
 * module is evaluated so that a malformed environment is itself reported (S1.5 AC6). The lint
 * rule names both files and nothing else.
 *
 * `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public values baked into the bundle (D38).
 * The service-role key is never read here or anywhere under `src/`.
 */

/** `.env.example` writes unset keys as `KEY=` and Vite hands them over as `''`. */
const blankToUndefined = (value: unknown) => (value === '' ? undefined : value)

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_APP_BASE_URL: z.string().url(), // share links, D13
  VITE_SENTRY_DSN: z.preprocess(blankToUndefined, z.string().url().optional()),
  VITE_SENTRY_RELEASE: z.preprocess(blankToUndefined, z.string().optional()),
  VITE_SENTRY_ENVIRONMENT: z.preprocess(blankToUndefined, z.string().optional()),
})

export type Env = z.infer<typeof envSchema>

export class EnvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvError'
  }
}

/** Exported for the test; production calls it once, below. */
export function parseEnv(source: unknown): Env {
  const result = envSchema.safeParse(source)
  if (result.success) return result.data
  const lines = result.error.issues.map(
    (issue) => `  ${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
  )
  throw new EnvError(
    `Invalid environment. Check .env.local against .env.example:\n${lines.join('\n')}`,
  )
}

export const env: Env = parseEnv(import.meta.env)
