// Which stack tests/db talks to.
//
// Default: the CLI's local stack. Every value is a published constant that `supabase start`
// prints on every machine (D38), repeated in .env.example, and deliberately not read from the
// environment: Vitest copies VITE_-prefixed keys from .env.local into process.env, which would
// silently point a test at the hosted project.
//
// Hosted, by explicit opt-in only: PFC_DB_TARGET=hosted (`npm run test:db:hosted`) reads
// .env.local directly. One project, no real data until go-live, and the suite may wipe it (D63).
import { readFileSync } from 'node:fs'

export const LOCAL = {
  url: 'http://127.0.0.1:54321',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  databaseUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
} as const

export type TargetKind = 'local' | 'hosted'

let cached: Record<string, string> | undefined

/** The key=value pairs in .env.local, parsed once. Values are never logged. */
export function envLocal(): Record<string, string> {
  if (cached) return cached
  const out: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  cached = out
  return out
}

/** Reads one .env.local key for the hosted target, failing loudly rather than sending ''. */
export function hostedValue(key: string): string {
  const value = envLocal()[key]
  if (!value) throw new Error(`PFC_DB_TARGET=hosted needs ${key} in .env.local`)
  return value
}

export const TARGET_KIND: TargetKind = process.env.PFC_DB_TARGET === 'hosted' ? 'hosted' : 'local'

export const TARGET =
  TARGET_KIND === 'hosted'
    ? {
        kind: 'hosted' as const,
        url: hostedValue('VITE_SUPABASE_URL'),
        anonKey: hostedValue('VITE_SUPABASE_ANON_KEY'),
        /** No direct Postgres connection to the hosted project; see sql.ts. */
        databaseUrl: null,
      }
    : { kind: 'local' as const, ...LOCAL }
