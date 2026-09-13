// Which stack tests/db and tests/rls talk to.
//
// Default: the CLI's local stack. Every value is a published constant that `supabase start`
// prints on every machine (D38), repeated in .env.example, and deliberately not read from the
// environment: Vitest copies VITE_-prefixed keys from .env.local into process.env, which would
// silently point a test at the hosted project.
//
// Hosted, by explicit opt-in only: PFC_DB_TARGET=hosted (`npm run test:db:hosted`, and always
// `npm run test:rls`). Credentials come from the environment first — that is how CI's `db` job
// supplies the repository secrets — then from .env.local. One project, no real data until go-live,
// and the suite may wipe it (D63), so the URL must belong to the project SUPABASE_PROJECT_REF
// names: a mismatch is refused before a single request is sent.
import { localStack } from '../../supabase/seed/local-stack.ts'
import { readFileSync } from 'node:fs'

// Resolved from `supabase status`, with the CLI-2.108 constants as fallback. See local-stack.ts.
const stack = localStack()
export const LOCAL = {
  url: stack.url,
  anonKey: stack.anonKey,
  databaseUrl: stack.databaseUrl,
  // Lazy: throws only if a local service-role key is actually needed with no stack running.
  get serviceRoleKey(): string {
    return stack.serviceRoleKey
  },
} as const

export type TargetKind = 'local' | 'hosted'

let cached: Record<string, string> | undefined

/** The key=value pairs in .env.local, parsed once; empty when the file is absent, as in CI. Values are never logged. */
export function envLocal(): Record<string, string> {
  if (cached) return cached
  const out: Record<string, string> = {}
  let text = ''
  try {
    text = readFileSync('.env.local', 'utf8')
  } catch {
    // No .env.local: the environment must carry every value.
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  cached = out
  return out
}

/** Reads one hosted-target key, environment first, then .env.local, failing loudly rather than sending ''. */
export function hostedValue(key: string): string {
  const value = process.env[key] ?? envLocal()[key]
  if (!value) throw new Error(`PFC_DB_TARGET=hosted needs ${key} in the environment or .env.local`)
  return value
}

/** The hosted URL, only if its host is the project SUPABASE_PROJECT_REF names (D63). */
function hostedUrl(): string {
  const url = hostedValue('VITE_SUPABASE_URL')
  const ref = hostedValue('SUPABASE_PROJECT_REF')
  const host = new URL(url).hostname
  if (host !== `${ref}.supabase.co`) {
    throw new Error(
      `VITE_SUPABASE_URL points at ${host}, not at project ${ref}; refusing to run against it`,
    )
  }
  return url
}

export const TARGET_KIND: TargetKind = process.env.PFC_DB_TARGET === 'hosted' ? 'hosted' : 'local'

export const TARGET =
  TARGET_KIND === 'hosted'
    ? {
        kind: 'hosted' as const,
        url: hostedUrl(),
        ref: hostedValue('SUPABASE_PROJECT_REF'),
        anonKey: hostedValue('VITE_SUPABASE_ANON_KEY'),
        /** No direct Postgres connection to the hosted project; see sql.ts. */
        databaseUrl: null,
      }
    : { kind: 'local' as const, ref: null, ...LOCAL }
