import { execFileSync } from 'node:child_process'

/**
 * The local Supabase stack's URL and keys.
 *
 * Resolved from `supabase status -o env` when a stack is running, so a CLI upgrade that changes
 * the key format cannot silently break the seed or the tests. CLI 2.108 issues
 * `sb_publishable_…` / `sb_secret_…` keys; the legacy `eyJ…supabase-demo` JWTs that earlier
 * versions printed are rejected by its gateway. That is exactly how the first CI `db` run failed.
 *
 * Falls back to the constants compiled into CLI 2.108 — the version CI pins — when `status` is
 * unavailable, for example when a hosted-target run has no local stack up. Those constants are
 * published local-development values (D38), not secrets.
 */
export interface LocalStack {
  url: string
  anonKey: string
  /** Throws when no stack is running: a local service-role key is only meaningful with one up. */
  readonly serviceRoleKey: string
  databaseUrl: string
  source: 'status' | 'fallback'
}

// Only the public half is a literal. The local secret key is also a published CLI constant, but
// it is shaped like a real one and GitHub's push protection rejects it — rightly, since a repo
// should not train anyone to wave secret-shaped strings through. `supabase status` supplies it.
const FALLBACK = {
  url: 'http://127.0.0.1:54321',
  anonKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
}

let cached: LocalStack | undefined

function parseEnvOutput(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^"(.*)"$/, '$1')
    if (key) out[key] = value
  }
  return out
}

export function localStack(): LocalStack {
  if (cached) return cached
  let text: string | undefined
  try {
    text = execFileSync('supabase', ['status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15_000,
    })
  } catch {
    // No running stack, or no CLI. The caller may not need a local stack at all.
  }
  if (text) {
    const v = parseEnvOutput(text)
    const url = v.API_URL
    const anonKey = v.PUBLISHABLE_KEY ?? v.ANON_KEY
    const serviceRoleKey = v.SECRET_KEY ?? v.SERVICE_ROLE_KEY
    if (url && anonKey && serviceRoleKey) {
      cached = {
        url,
        anonKey,
        serviceRoleKey,
        databaseUrl: v.DB_URL ?? FALLBACK.databaseUrl,
        source: 'status',
      }
      return cached
    }
  }
  cached = {
    ...FALLBACK,
    source: 'fallback',
    get serviceRoleKey(): string {
      throw new Error(
        'No local Supabase stack is running (supabase status failed), so there is no local ' +
          'service-role key. Run `supabase start`, or target the hosted project explicitly.',
      )
    },
  }
  return cached
}
