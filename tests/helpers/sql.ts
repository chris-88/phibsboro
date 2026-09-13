// Raw SQL as postgres, for catalog reads and the one thing PostgREST cannot see (auth.users).
// Local: a pg connection to the CLI stack. Hosted: the Management API query endpoint, the same
// route scripts/db.mjs uses, with the access token from .env.local. No parameters on the hosted
// path, so callers quote with lit() and pass nothing user-controlled.
import pg from 'pg'

import { TARGET, hostedValue } from './target.ts'

let pool: pg.Pool | undefined

export async function sql<R extends Record<string, unknown>>(text: string): Promise<R[]> {
  if (TARGET.kind === 'local') {
    pool ??= new pg.Pool({ connectionString: TARGET.databaseUrl, max: 2 })
    const result = await pool.query<R>(text)
    return result.rows
  }
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${hostedValue('SUPABASE_PROJECT_REF')}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hostedValue('SUPABASE_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: text }),
    },
  )
  if (!response.ok) throw new Error(`sql: HTTP ${String(response.status)} ${await response.text()}`)
  return (await response.json()) as R[]
}

/** A SQL string literal. */
export const lit = (value: string) => `'${value.replaceAll("'", "''")}'`

/** count(*) comes back as a string from pg and a number from the Management API. */
export async function scalar(text: string): Promise<number> {
  const rows = await sql<Record<string, unknown>>(text)
  const first = rows[0]
  if (!first) throw new Error(`sql: no row for ${text}`)
  const value = Object.values(first)[0]
  return Number(value)
}

export async function closeSql() {
  await pool?.end()
  pool = undefined
}
