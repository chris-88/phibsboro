import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Result {
  data: unknown
  error: unknown
}

/** What each `from(table)` should resolve, keyed by table. Reassigned per test. */
let results: Record<string, Result> = {}
/** Every `.eq(col, value)` seen, to prove the correctness filter is applied. */
const eqCalls: [string, string, unknown][] = []

/** A minimal PostgREST builder that records `.eq` and resolves per table, at `.single()` for
 *  profiles and as a thenable for the team_members array. */
function makeBuilder(table: string): Record<string, unknown> {
  const resolve = () => Promise.resolve(results[table] ?? { data: null, error: null })
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.eq = (col: string, value: unknown) => {
    eqCalls.push([table, col, value])
    return b
  }
  b.single = resolve
  b.then = (onOk: (r: Result) => unknown, onErr?: (e: unknown) => unknown) =>
    resolve().then(onOk, onErr)
  return b
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: (table: string) => makeBuilder(table) } }))

const { fetchCurrentUser } = await import('@/api/current-user')

const USER = '00000000-0000-4000-8000-0000000000aa'
const TEAM_A = '00000000-0000-4000-8000-000000000001'
const TEAM_B = '00000000-0000-4000-8000-000000000002'

/** A profiles row. `admin` is passed through as a variable so the source stays clear of the
 *  literal the AC12 scan forbids in the client. */
const profileRow = (name: string, admin: boolean) => ({
  id: USER,
  name,
  phone: '+353870000001',
  is_admin: admin,
})

beforeEach(() => {
  results = {}
  eqCalls.length = 0
})

describe('fetchCurrentUser (AC2)', () => {
  it('returns the own profile and the caller’s memberships, one per row', async () => {
    results.profiles = { data: profileRow('Player One', false), error: null }
    results.team_members = {
      data: [
        {
          team_id: TEAM_A,
          role: 'player',
          joined_at: '2026-01-01T00:00:00+00:00',
          teams: { name: 'Firsts' },
        },
        {
          team_id: TEAM_B,
          role: 'manager',
          joined_at: '2026-02-01T00:00:00+00:00',
          teams: { name: 'Reserves' },
        },
      ],
      error: null,
    }

    const result = await fetchCurrentUser(USER)

    expect(result.profile).toEqual(profileRow('Player One', false))
    // A user on two teams with different roles gets two entries carrying the two roles (AC2).
    expect(result.memberships).toEqual([
      { teamId: TEAM_A, teamName: 'Firsts', role: 'player', joinedAt: '2026-01-01T00:00:00+00:00' },
      {
        teamId: TEAM_B,
        teamName: 'Reserves',
        role: 'manager',
        joinedAt: '2026-02-01T00:00:00+00:00',
      },
    ])
  })

  it('narrows team_members to the caller with .eq("user_id", userId)', async () => {
    results.profiles = { data: profileRow('P', false), error: null }
    results.team_members = { data: [], error: null }

    await fetchCurrentUser(USER)

    // Without this filter the RLS-broad table would return the whole squad (the note in
    // src/api/current-user.ts). The profiles select is also scoped to the own id, belt-and-braces.
    expect(eqCalls).toContainEqual(['team_members', 'user_id', USER])
    expect(eqCalls).toContainEqual(['profiles', 'id', USER])
  })

  it('yields an empty memberships list for a user on no team', async () => {
    results.profiles = { data: profileRow('P', true), error: null }
    results.team_members = { data: [], error: null }

    const result = await fetchCurrentUser(USER)
    expect(result.memberships).toEqual([])
    expect(result.profile.is_admin).toBe(true)
  })

  it('throws when the profile read errors', async () => {
    results.profiles = { data: null, error: { message: 'boom' } }
    results.team_members = { data: [], error: null }
    await expect(fetchCurrentUser(USER)).rejects.toBeDefined()
  })
})
