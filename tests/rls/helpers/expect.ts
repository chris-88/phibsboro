// The three shapes a denial takes through PostgREST, each with its own helper so a silent no-op
// can never read as a pass (S1.4 AC6):
//
//   select / update / delete filtered by `using`   → 200, data [], error null      expectEmpty
//     — every filtered write is paired with expectRowUnchanged, because [] is also what a
//       successful write returns when .select() is omitted
//   insert or `with check` refused, or no grant     → error.code 42501             expectRlsDenied
//   RPC raised                                      → error.message is one of six  expectRpcError
//
// expectRowUnchanged and expectRowAbsent are the only reads through the service-role client
// anywhere in the suite; they exist to prove a refused write wrote nothing (AC8).
import type { PostgrestError } from '@supabase/supabase-js'
import { expect } from 'vitest'

import type { Database } from '../../../src/lib/database.types.ts'
import { adminClient } from '../../helpers/admin.ts'

interface Response {
  data: unknown
  error: PostgrestError | null
  count?: number | null
}

/** Zero rows and no error: the row was filtered away, not refused. */
export function expectEmpty(res: Response) {
  expect(res.error).toBeNull()
  expect(res.data ?? []).toEqual([])
  if (typeof res.count === 'number') expect(res.count).toBe(0)
}

/** Exactly `n` rows and no error. Returns them. */
export function expectRows<T>(res: { data: T[] | null; error: PostgrestError | null }, n: number) {
  expect(res.error).toBeNull()
  expect(res.data).not.toBeNull()
  expect(res.data).toHaveLength(n)
  return res.data ?? []
}

/** Postgres refused the statement: no privilege, or a `with check` failed. */
export function expectRlsDenied(res: { error: PostgrestError | null }) {
  expect(res.error).not.toBeNull()
  expect(res.error?.code).toBe('42501')
}

export const RPC_ERRORS = [
  'invalid_invite',
  'invalid_token',
  'not_authorised',
  'phone_taken',
  'series_too_long',
  'starts_in_past',
] as const
export type RpcError = (typeof RPC_ERRORS)[number]

/** The RPC raised exactly this word and nothing more (S1.3 AC23). */
export function expectRpcError(res: { error: PostgrestError | null }, message: RpcError) {
  expect(res.error).not.toBeNull()
  expect(res.error?.code).toBe('P0001')
  expect(res.error?.message).toBe(message)
}

/** `anon` calling a function it holds no execute on. */
export function expectNoExecute(res: { error: PostgrestError | null }) {
  expect(res.error).not.toBeNull()
  expect(res.error?.code).toBe('42501')
  expect(res.error?.message).toMatch(/permission denied for function/)
}

type Table = keyof Database['public']['Tables']
type Row<T extends Table> = Database['public']['Tables'][T]['Row']

async function readRows<T extends Table>(table: T, match: Partial<Row<T>>) {
  const { data, error } = await adminClient().from(table).select('*').match(match)
  if (error) throw new Error(`re-read ${table}: ${error.message}`)
  // The generic table name defeats supabase-js's select inference; the rows are the table's.
  return data as unknown as Row<T>[]
}

/** The stored row still holds every expected value. Pairs with every filtered update or delete. */
export async function expectRowUnchanged<T extends Table>(
  table: T,
  match: Partial<Row<T>>,
  expected: Partial<Row<T>>,
) {
  const rows = await readRows(table, match)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject(expected)
}

/** No such row exists. Pairs with every refused insert. */
export async function expectRowAbsent<T extends Table>(table: T, match: Partial<Row<T>>) {
  expect(await readRows(table, match)).toEqual([])
}

/**
 * A delete the `on delete restrict` FK must refuse even for the service-role key, which bypasses
 * RLS. Proves a team that still owns rows cannot be dropped: deactivation is the only retirement
 * path (D31, S6.1). Kept here so no test file names the service-role client (S1.4 AC8).
 */
export async function expectDeleteRestricted<T extends Table>(table: T, match: Partial<Row<T>>) {
  const { error } = await adminClient().from(table).delete().match(match)
  expect(error).not.toBeNull()
  expect(error?.code).toBe('23503')
}

/** Exactly `n` matching rows exist. */
export async function expectRowCount<T extends Table>(table: T, match: Partial<Row<T>>, n: number) {
  expect(await readRows(table, match)).toHaveLength(n)
}

/** 32 random bytes as base64url: 43 characters of [A-Za-z0-9_-] (D5, AC14). */
export function expectTokenShape(token: unknown): asserts token is string {
  expect(typeof token).toBe('string')
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
}
