// S17.3 — match_stats (v1.3.0, X4/X6/X8). A team manager/admin writes and reads every row for a
// match; a player reads only their own and cannot write; anon nothing. The reseed does not truncate
// match_stats, so this suite clears its own rows and its throwaway match.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { deleteAllMatchStats, deleteEvent, insertEvent } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { FIRSTS } from './helpers/fixtures.ts'
import { expectEmpty, expectRlsDenied, expectRows } from './helpers/expect.ts'

const MATCH = '00000000-0000-4000-8000-0000000000f1'

beforeAll(async () => {
  await deleteAllMatchStats()
  await insertEvent({
    id: MATCH,
    team_id: FIRSTS,
    type: 'match',
    title: 'RLS match',
    location: 'Somewhere',
    opponent: 'Rovers',
    home_away: 'home',
    starts_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  })
})

afterAll(async () => {
  await deleteAllMatchStats()
  await deleteEvent(MATCH)
})

describe('match_stats — manager writes and reads all; a player reads only their own (S17.3)', () => {
  it('a team manager upserts a row and reads every row for the match', async () => {
    const declan = await signInAs('managerFirsts')
    expect(
      (
        await declan.from('match_stats').insert({
          event_id: MATCH,
          user_id: idOf('playerFirsts'),
          goals: 2,
          assists: 1,
          recorded_by: idOf('managerFirsts'),
        })
      ).error,
    ).toBeNull()
    const rows = expectRows(
      await declan.from('match_stats').select('user_id, goals, assists').eq('event_id', MATCH),
      1,
    )
    expect(rows[0]).toEqual({ user_id: idOf('playerFirsts'), goals: 2, assists: 1 })
  })

  it('a player cannot write, and reads only their own row', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('match_stats')
        .insert({ event_id: MATCH, user_id: idOf('playerFirsts'), goals: 9 }),
    )
    const own = expectRows(
      await aaron.from('match_stats').select('user_id').eq('event_id', MATCH),
      1,
    )
    expect(own[0]?.user_id).toBe(idOf('playerFirsts'))
    // A different player sees none of another's stats.
    const ben = await signInAs('playerFirstsOther')
    expectEmpty(await ben.from('match_stats').select('*').eq('event_id', MATCH))
  })

  it('anon can neither read nor write', async () => {
    expectRlsDenied(
      await anonClient()
        .from('match_stats')
        .insert({ event_id: MATCH, user_id: idOf('playerFirsts'), goals: 1 }),
    )
    expectEmpty(await anonClient().from('match_stats').select('*'))
  })
})
