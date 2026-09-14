// S9.1 — the matchday squad (V6, V7). event_squad mirrors attendance: a manager of the event's
// team (and admins) writes, every team member reads their team's rows, anon nothing, recorded_by
// is the writer. On top of attendance's rules, the V7 pool rule — a squad row needs an
// event_responses.response='available' row — is enforced on both write paths: the set_squad_member
// RPC (a clean word) and the table's `with check` (a 42501 for a raw PostgREST insert). Every
// path below is asserted positive and negative, and the squad is cleared after each test so the
// seeded state (0 squad rows) is restored (AC13).
//
// The event under test is Firsts' far match (scheduled): Aaron (playerFirsts) and Ben
// (playerFirstsOther) answered available; Ian (playerFirstsAwaiting) holds no response anywhere.
import { afterEach, describe, expect, it } from 'vitest'

import {
  createThrowaway,
  deleteAllSquad,
  deleteEvent,
  deleteMembership,
  deleteThrowaway,
  insertEvent,
  insertMembership,
  insertSquad,
} from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { EVENT, FIRSTS } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectNoExecute,
  expectRlsDenied,
  expectRowAbsent,
  expectRowCount,
  expectRows,
} from './helpers/expect.ts'

const FAR = EVENT.firsts.far.id

/** The RPC raised exactly this word and nothing more — the six-word set plus the three squad
 *  words S9.1 adds (not_available, number_taken, captain_taken). */
function expectRaised(res: { error: { code: string; message: string } | null }, message: string) {
  expect(res.error).not.toBeNull()
  expect(res.error?.code).toBe('P0001')
  expect(res.error?.message).toBe(message)
}

/** A Postgres constraint refused the statement: a check (23514) or a unique index (23505). */
function expectConstraint(res: { error: { code: string } | null }, code: string) {
  expect(res.error).not.toBeNull()
  expect(res.error?.code).toBe(code)
}

// One database, one writer at a time (vitest.rls fileParallelism:false); still, leave no squad row.
afterEach(async () => {
  await deleteAllSquad()
})

describe('AC2 — who may write the squad', () => {
  it('a manager of the team sets, renumbers and removes an available player via the RPC', async () => {
    const declan = await signInAs('managerFirsts')
    const aaron = idOf('playerFirsts')

    // Set: shirt 7, captain.
    expect(
      (
        await declan.rpc('set_squad_member', {
          p_event_id: FAR,
          p_user_id: aaron,
          p_shirt_number: 7,
          p_is_captain: true,
        })
      ).error,
    ).toBeNull()
    const set = expectRows(
      await declan
        .from('event_squad')
        .select('shirt_number, is_captain, recorded_by, updated_at')
        .match({ event_id: FAR, user_id: aaron }),
      1,
    )
    expect(set[0]?.shirt_number).toBe(7)
    expect(set[0]?.is_captain).toBe(true)
    // AC6: recorded_by is the acting manager, and updated_at is set on write.
    expect(set[0]?.recorded_by).toBe(idOf('managerFirsts'))
    expect(typeof set[0]?.updated_at).toBe('string')

    // Renumber: shirt 9, no armband.
    expect(
      (
        await declan.rpc('set_squad_member', {
          p_event_id: FAR,
          p_user_id: aaron,
          p_shirt_number: 9,
          p_is_captain: false,
        })
      ).error,
    ).toBeNull()
    const updated = expectRows(
      await declan
        .from('event_squad')
        .select('shirt_number, is_captain')
        .match({ event_id: FAR, user_id: aaron }),
      1,
    )
    expect(updated[0]).toEqual({ shirt_number: 9, is_captain: false })

    // Remove.
    expect(
      (await declan.rpc('remove_squad_member', { p_event_id: FAR, p_user_id: aaron })).error,
    ).toBeNull()
    expectEmpty(
      await declan.from('event_squad').select('*').match({ event_id: FAR, user_id: aaron }),
    )
  })

  it('a manager of the team may also write directly (the policy path, not only the RPC)', async () => {
    const declan = await signInAs('managerFirsts')
    const ben = idOf('playerFirstsOther')
    expectRows(
      await declan
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: ben,
          shirt_number: 4,
          is_captain: false,
          recorded_by: idOf('managerFirsts'),
        })
        .select('user_id'),
      1,
    )
    expectRows(
      await declan
        .from('event_squad')
        .update({ shirt_number: 5 })
        .match({ event_id: FAR, user_id: ben })
        .select('shirt_number'),
      1,
    )
    expectRows(
      await declan.from('event_squad').delete().match({ event_id: FAR, user_id: ben }).select(),
      1,
    )
  })

  it('a manager of another team cannot write, by RPC or directly', async () => {
    const niamh = await signInAs('managerSeconds')
    const aaron = idOf('playerFirsts')
    expectRaised(
      await niamh.rpc('set_squad_member', {
        p_event_id: FAR,
        p_user_id: aaron,
        p_shirt_number: 3,
        p_is_captain: false,
      }),
      'not_authorised',
    )
    expectRlsDenied(
      await niamh
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: aaron,
          shirt_number: 3,
          is_captain: false,
          recorded_by: idOf('managerSeconds'),
        })
        .select(),
    )
    await expectRowAbsent('event_squad', { event_id: FAR, user_id: aaron })
  })

  it('a player cannot write the squad, by RPC or directly', async () => {
    const aaron = await signInAs('playerFirsts')
    const me = idOf('playerFirsts')
    expectRaised(
      await aaron.rpc('set_squad_member', {
        p_event_id: FAR,
        p_user_id: me,
        p_shirt_number: 3,
        p_is_captain: false,
      }),
      'not_authorised',
    )
    expectRaised(
      await aaron.rpc('remove_squad_member', { p_event_id: FAR, p_user_id: me }),
      'not_authorised',
    )
    expectRaised(await aaron.rpc('clear_squad', { p_event_id: FAR }), 'not_authorised')
    expectRlsDenied(
      await aaron
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: me,
          shirt_number: 3,
          is_captain: false,
          recorded_by: me,
        })
        .select(),
    )
    await expectRowAbsent('event_squad', { event_id: FAR, user_id: me })
  })

  it('anon holds no execute on the RPCs and no privilege on the table', async () => {
    const anon = anonClient()
    expectNoExecute(
      await anon.rpc('set_squad_member', {
        p_event_id: FAR,
        p_user_id: idOf('playerFirsts'),
        p_shirt_number: 3,
        p_is_captain: false,
      }),
    )
    expectNoExecute(
      await anon.rpc('remove_squad_member', { p_event_id: FAR, p_user_id: idOf('playerFirsts') }),
    )
    expectNoExecute(await anon.rpc('clear_squad', { p_event_id: FAR }))
    expectRlsDenied(await anon.from('event_squad').select('*'))
    expectRlsDenied(
      await anon
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: idOf('playerFirsts'),
          shirt_number: 3,
          is_captain: false,
          recorded_by: idOf('playerFirsts'),
        })
        .select(),
    )
  })
})

describe('AC3 — the available-only rule (V7)', () => {
  it('the RPC refuses a player with no available response, naming no column', async () => {
    const declan = await signInAs('managerFirsts')
    const ian = idOf('playerFirstsAwaiting')
    const res = await declan.rpc('set_squad_member', {
      p_event_id: FAR,
      p_user_id: ian,
      p_shirt_number: 3,
      p_is_captain: false,
    })
    expectRaised(res, 'not_available')
    // The refusal is the one word only — no column, table or constraint leaks.
    expect(res.error?.message).toBe('not_available')
    await expectRowAbsent('event_squad', { event_id: FAR, user_id: ian })
  })

  it('a raw PostgREST insert for a non-available player is refused 42501 by the policy', async () => {
    const declan = await signInAs('managerFirsts')
    const ian = idOf('playerFirstsAwaiting')
    expectRlsDenied(
      await declan
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: ian,
          shirt_number: 3,
          is_captain: false,
          recorded_by: idOf('managerFirsts'),
        })
        .select(),
    )
    await expectRowAbsent('event_squad', { event_id: FAR, user_id: ian })
  })
})

describe('AC4 — numbers, captain and range', () => {
  it('two players cannot share a shirt number — RPC and direct', async () => {
    const declan = await signInAs('managerFirsts')
    const aaron = idOf('playerFirsts')
    const ben = idOf('playerFirstsOther')
    expect(
      (
        await declan.rpc('set_squad_member', {
          p_event_id: FAR,
          p_user_id: aaron,
          p_shirt_number: 7,
          p_is_captain: false,
        })
      ).error,
    ).toBeNull()
    expectRaised(
      await declan.rpc('set_squad_member', {
        p_event_id: FAR,
        p_user_id: ben,
        p_shirt_number: 7,
        p_is_captain: false,
      }),
      'number_taken',
    )
    // The unique index is the backstop for a direct write.
    expectConstraint(
      await declan
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: ben,
          shirt_number: 7,
          is_captain: false,
          recorded_by: idOf('managerFirsts'),
        })
        .select(),
      '23505',
    )
  })

  it('at most one captain per match — RPC and direct', async () => {
    const declan = await signInAs('managerFirsts')
    const aaron = idOf('playerFirsts')
    const ben = idOf('playerFirstsOther')
    expect(
      (
        await declan.rpc('set_squad_member', {
          p_event_id: FAR,
          p_user_id: aaron,
          p_shirt_number: 7,
          p_is_captain: true,
        })
      ).error,
    ).toBeNull()
    expectRaised(
      await declan.rpc('set_squad_member', {
        p_event_id: FAR,
        p_user_id: ben,
        p_shirt_number: 8,
        p_is_captain: true,
      }),
      'captain_taken',
    )
    // The partial unique index is the backstop for a direct write.
    expectConstraint(
      await declan
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: ben,
          shirt_number: 8,
          is_captain: true,
          recorded_by: idOf('managerFirsts'),
        })
        .select(),
      '23505',
    )
  })

  it('a shirt number outside 1–20 is rejected — RPC and direct', async () => {
    const declan = await signInAs('managerFirsts')
    const aaron = idOf('playerFirsts')
    expectRaised(
      await declan.rpc('set_squad_member', {
        p_event_id: FAR,
        p_user_id: aaron,
        p_shirt_number: 21,
        p_is_captain: false,
      }),
      'not_authorised',
    )
    expectRaised(
      await declan.rpc('set_squad_member', {
        p_event_id: FAR,
        p_user_id: aaron,
        p_shirt_number: 0,
        p_is_captain: false,
      }),
      'not_authorised',
    )
    // The table check is the backstop for a direct write of an available player.
    expectConstraint(
      await declan
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: aaron,
          shirt_number: 21,
          is_captain: false,
          recorded_by: idOf('managerFirsts'),
        })
        .select(),
      '23514',
    )
    await expectRowAbsent('event_squad', { event_id: FAR, user_id: aaron })
  })
})

describe('AC5 — cascade and membership', () => {
  it('deleting the event cascades its squad rows', async () => {
    const eventId = '00000000-0000-4000-8000-0000000091f1'
    await insertEvent({
      id: eventId,
      team_id: FIRSTS,
      type: 'match',
      title: 'Firsts v Cascade',
      location: 'Tolka Park',
      starts_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    })
    await insertSquad({
      event_id: eventId,
      user_id: idOf('playerFirsts'),
      shirt_number: 1,
      is_captain: false,
      recorded_by: idOf('managerFirsts'),
    })
    await deleteEvent(eventId)
    await expectRowAbsent('event_squad', { event_id: eventId })
  })

  it('removing a membership keeps the squad row; deleting the profile cascades it (D33)', async () => {
    const throwaway = await createThrowaway(1, 'Squad Leaver')
    try {
      await insertMembership({ team_id: FIRSTS, user_id: throwaway.id, role: 'player' })
      await insertSquad({
        event_id: FAR,
        user_id: throwaway.id,
        shirt_number: 15,
        is_captain: false,
        recorded_by: idOf('managerFirsts'),
      })
      // A leaver keeps their historic squad row (squad is keyed on user_id, not membership).
      await deleteMembership(FIRSTS, throwaway.id)
      await expectRowCount('event_squad', { event_id: FAR, user_id: throwaway.id }, 1)
    } finally {
      // Deleting the profile (auth user) cascades the squad row away.
      await deleteThrowaway(throwaway.id)
    }
    await expectRowAbsent('event_squad', { event_id: FAR, user_id: throwaway.id })
  })
})

describe('AC6 — recorded_by cannot be forged', () => {
  it('a manager direct insert attributing recorded_by to someone else is refused', async () => {
    const declan = await signInAs('managerFirsts')
    const aaron = idOf('playerFirsts')
    expectRlsDenied(
      await declan
        .from('event_squad')
        .insert({
          event_id: FAR,
          user_id: aaron,
          shirt_number: 7,
          is_captain: false,
          recorded_by: idOf('playerFirsts'),
        })
        .select(),
    )
    await expectRowAbsent('event_squad', { event_id: FAR, user_id: aaron })
  })
})

describe('AC2 read — who reads which squad', () => {
  it('every team member reads their team squad; other-team manager, stranger and anon do not', async () => {
    // Arrange one row on Firsts' far match through the service role.
    await insertSquad({
      event_id: FAR,
      user_id: idOf('playerFirsts'),
      shirt_number: 10,
      is_captain: false,
      recorded_by: idOf('managerFirsts'),
    })

    const aaron = await signInAs('playerFirsts') // Firsts player
    expectRows(await aaron.from('event_squad').select('user_id').eq('event_id', FAR), 1)

    const declan = await signInAs('managerFirsts') // Firsts manager
    expectRows(await declan.from('event_squad').select('user_id').eq('event_id', FAR), 1)

    const admin = await signInAs('admin')
    expectRows(await admin.from('event_squad').select('user_id').eq('event_id', FAR), 1)

    const niamh = await signInAs('managerSeconds') // manages Seconds only
    expectEmpty(await niamh.from('event_squad').select('*', { count: 'exact' }).eq('event_id', FAR))

    const sean = await signInAs('stranger')
    expectEmpty(await sean.from('event_squad').select('*', { count: 'exact' }).eq('event_id', FAR))

    expectRlsDenied(await anonClient().from('event_squad').select('*'))
  })
})
