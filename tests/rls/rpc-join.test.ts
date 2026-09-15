// Rows 27–29: join_team_by_token and join_team_by_event (D6, D26, D28, D50). The role comes from
// the invite row, a re-join is a no-op, and every failure is the one word invalid_invite.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  deleteAllInvites,
  deleteEvent,
  deleteMembership,
  expireInvite,
  insertEvent,
  setTeamActive,
} from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { EVENT, FIRSTS, SECONDS, UNKNOWN_UUID } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectNoExecute,
  expectRowAbsent,
  expectRows,
  expectRpcError,
  expectTokenShape,
} from './helpers/expect.ts'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const STALE_EVENT = '00000000-0000-4000-8000-0000000000e8' // Seconds, 8 days ago
const RECENT_EVENT = '00000000-0000-4000-8000-0000000000e6' // Seconds, 6 days ago

let playerToken = ''
let managerToken = ''

beforeAll(async () => {
  const admin = await signInAs('admin')
  const player = await admin.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
  const manager = await admin.rpc('create_team_invite', { p_team_id: SECONDS, p_role: 'manager' })
  expectTokenShape(player.data)
  expectTokenShape(manager.data)
  playerToken = player.data
  managerToken = manager.data
  await insertEvent({
    id: STALE_EVENT,
    team_id: SECONDS,
    type: 'training',
    title: 'RLS stale',
    location: 'Nowhere',
    starts_at: daysAgo(8),
  })
  await insertEvent({
    id: RECENT_EVENT,
    team_id: SECONDS,
    type: 'training',
    title: 'RLS recent',
    location: 'Nowhere',
    starts_at: daysAgo(6),
  })
})

afterAll(async () => {
  await setTeamActive(FIRSTS, true)
  await setTeamActive(SECONDS, true)
  await deleteMembership(FIRSTS, idOf('stranger'))
  await deleteMembership(SECONDS, idOf('stranger'))
  await deleteMembership(FIRSTS, idOf('admin'))
  await deleteMembership(SECONDS, idOf('admin'))
  await deleteEvent(STALE_EVENT)
  await deleteEvent(RECENT_EVENT)
  await deleteAllInvites()
})

describe('row 27 — join_team_by_token with a player invite', () => {
  let joinedAt = ''

  it("stranger joins as the invite's role and can now read the team", async () => {
    const sean = await signInAs('stranger')
    expectEmpty(await sean.from('teams').select('*'))
    const rows = expectRows(await sean.rpc('join_team_by_token', { p_token: playerToken }), 1)
    expect(rows[0]).toEqual({ team_id: FIRSTS, team_name: 'Firsts' })
    const membership = expectRows(
      await sean.from('team_members').select('role, joined_at').eq('user_id', idOf('stranger')),
      1,
    )
    expect(membership[0]?.role).toBe('player')
    joinedAt = membership[0]?.joined_at ?? ''
    expect(joinedAt).not.toBe('')
    expectRows(await sean.from('teams').select('id').eq('id', FIRSTS), 1)
  })

  it('second call creates no duplicate and does not move joined_at', async () => {
    const sean = await signInAs('stranger')
    const rows = expectRows(await sean.rpc('join_team_by_token', { p_token: playerToken }), 1)
    expect(rows[0]).toEqual({ team_id: FIRSTS, team_name: 'Firsts' })
    const membership = expectRows(
      await sean.from('team_members').select('role, joined_at').eq('user_id', idOf('stranger')),
      1,
    )
    expect(membership[0]).toEqual({ role: 'player', joined_at: joinedAt })
  })

  it('admin looks the token up and joins by it like anyone else (row 40)', async () => {
    const admin = await signInAs('admin')
    const looked = expectRows(await admin.rpc('lookup_team_invite', { p_token: playerToken }), 1)
    expect(looked[0]).toEqual({ team_id: FIRSTS, team_name: 'Firsts', role: 'player' })
    const rows = expectRows(await admin.rpc('join_team_by_token', { p_token: playerToken }), 1)
    expect(rows[0]).toEqual({ team_id: FIRSTS, team_name: 'Firsts' })
    const membership = expectRows(
      await admin
        .from('team_members')
        .select('role')
        .match({ team_id: FIRSTS, user_id: idOf('admin') }),
      1,
    )
    expect(membership[0]).toEqual({ role: 'player' })
    await deleteMembership(FIRSTS, idOf('admin')) // the admin belongs to no team (D2)
  })

  it('a manager argument cannot override a player invite: the function takes no such argument', async () => {
    const liam = await signInAs('playerSeconds')
    // The extra argument is the attack; PostgREST finds no function with that signature.
    const res = await liam.rpc('join_team_by_token', { p_token: playerToken, p_role: 'manager' })
    expect(res.error).not.toBeNull()
    expect(res.error?.code).toBe('PGRST202')
    await expectRowAbsent('team_members', { team_id: FIRSTS, user_id: idOf('playerSeconds') })
  })

  it('unknown token raises invalid_invite', async () => {
    const liam = await signInAs('playerSeconds')
    expectRpcError(
      await liam.rpc('join_team_by_token', { p_token: 'x'.repeat(43) }),
      'invalid_invite',
    )
    expectRpcError(await liam.rpc('join_team_by_token', { p_token: '' }), 'invalid_invite')
    await expectRowAbsent('team_members', { team_id: FIRSTS, user_id: idOf('playerSeconds') })
  })

  it('inactive-team token raises invalid_invite', async () => {
    const liam = await signInAs('playerSeconds')
    await setTeamActive(FIRSTS, false)
    try {
      expectRpcError(
        await liam.rpc('join_team_by_token', { p_token: playerToken }),
        'invalid_invite',
      )
    } finally {
      await setTeamActive(FIRSTS, true)
    }
    await expectRowAbsent('team_members', { team_id: FIRSTS, user_id: idOf('playerSeconds') })
  })

  it('revoked token raises invalid_invite', async () => {
    const admin = await signInAs('admin')
    const liam = await signInAs('playerSeconds')
    expect(
      (await admin.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' })).error,
    ).toBeNull()
    expectRpcError(await liam.rpc('join_team_by_token', { p_token: playerToken }), 'invalid_invite')
    await expectRowAbsent('team_members', { team_id: FIRSTS, user_id: idOf('playerSeconds') })
  })

  it('expired token raises invalid_invite', async () => {
    const admin = await signInAs('admin')
    const liam = await signInAs('playerSeconds')
    const fresh = await admin.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
    expectTokenShape(fresh.data)
    await expireInvite(fresh.data)
    expectRpcError(await liam.rpc('join_team_by_token', { p_token: fresh.data }), 'invalid_invite')
    await expectRowAbsent('team_members', { team_id: FIRSTS, user_id: idOf('playerSeconds') })
  })

  it('anon cannot execute join_team_by_token', async () => {
    expectNoExecute(await anonClient().rpc('join_team_by_token', { p_token: playerToken }))
  })
})

// Regression (reported 2026-09-15): a user who first joins a team as a player and then redeems that
// team's manager invite must be UPGRADED to manager. join_team_by_token used `on conflict do
// nothing`, so the existing player row swallowed the manager row and the user stayed a player —
// while the single-use manager invite was still consumed, so re-tapping could not recover it. The
// insert now upgrades on conflict, but only ever upwards (never a downgrade). Uses `stranger`, who
// row 27 left as a player on Firsts; the file's afterAll deletes that membership, so no residue.
describe('join_team_by_token upgrades an existing membership, and never downgrades it', () => {
  it("a player who redeems that team's manager invite is upgraded to manager", async () => {
    const admin = await signInAs('admin')
    const sean = await signInAs('stranger')
    const before = expectRows(
      await sean
        .from('team_members')
        .select('role')
        .match({ team_id: FIRSTS, user_id: idOf('stranger') }),
      1,
    )
    expect(before[0]).toEqual({ role: 'player' })

    const mgr = await admin.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'manager' })
    expectTokenShape(mgr.data)
    expectRows(await sean.rpc('join_team_by_token', { p_token: mgr.data }), 1)

    const upgraded = expectRows(
      await sean
        .from('team_members')
        .select('role')
        .match({ team_id: FIRSTS, user_id: idOf('stranger') }),
      1,
    )
    expect(upgraded[0]).toEqual({ role: 'manager' })
  })

  it('a later player invite for the same team does not knock the manager back to player', async () => {
    const admin = await signInAs('admin')
    const sean = await signInAs('stranger')
    const plr = await admin.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
    expectTokenShape(plr.data)
    expectRows(await sean.rpc('join_team_by_token', { p_token: plr.data }), 1)
    const still = expectRows(
      await sean
        .from('team_members')
        .select('role')
        .match({ team_id: FIRSTS, user_id: idOf('stranger') }),
      1,
    )
    expect(still[0]).toEqual({ role: 'manager' })
  })
})

describe('row 28 — join_team_by_token with a manager invite is single use (D28)', () => {
  it("admin's manager invite promotes on first use", async () => {
    const sean = await signInAs('stranger')
    const rows = expectRows(await sean.rpc('join_team_by_token', { p_token: managerToken }), 1)
    expect(rows[0]).toEqual({ team_id: SECONDS, team_name: 'Seconds' })
    const membership = expectRows(
      await sean
        .from('team_members')
        .select('role')
        .match({ team_id: SECONDS, user_id: idOf('stranger') }),
      1,
    )
    expect(membership[0]).toEqual({ role: 'manager' })
  })

  it('the same manager token used a second time raises invalid_invite', async () => {
    const liam = await signInAs('playerSeconds')
    expectRpcError(
      await liam.rpc('join_team_by_token', { p_token: managerToken }),
      'invalid_invite',
    )
    expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: managerToken }))
  })
})

describe('row 29 — join_team_by_event (D6)', () => {
  it('stranger joins as player from a future event id', async () => {
    await deleteMembership(SECONDS, idOf('stranger')) // the manager row from row 28
    const sean = await signInAs('stranger')
    const rows = expectRows(
      await sean.rpc('join_team_by_event', { p_event_id: EVENT.seconds.far.id }),
      1,
    )
    expect(rows[0]).toEqual({ team_id: SECONDS, team_name: 'Seconds' })
    const membership = expectRows(
      await sean
        .from('team_members')
        .select('role, joined_at')
        .match({ team_id: SECONDS, user_id: idOf('stranger') }),
      1,
    )
    expect(membership[0]?.role).toBe('player')
    const joinedAt = membership[0]?.joined_at
    // Idempotent, and joining by event never promotes.
    expectRows(await sean.rpc('join_team_by_event', { p_event_id: EVENT.seconds.imminent.id }), 1)
    const again = expectRows(
      await sean
        .from('team_members')
        .select('role, joined_at')
        .match({ team_id: SECONDS, user_id: idOf('stranger') }),
      1,
    )
    expect(again[0]).toEqual({ role: 'player', joined_at: joinedAt })
  })

  it('an event six days past still joins; one eight days past raises invalid_invite', async () => {
    const admin = await signInAs('admin')
    const rows = expectRows(await admin.rpc('join_team_by_event', { p_event_id: RECENT_EVENT }), 1)
    expect(rows[0]).toEqual({ team_id: SECONDS, team_name: 'Seconds' })
    await deleteMembership(SECONDS, idOf('admin'))
    expectRpcError(
      await admin.rpc('join_team_by_event', { p_event_id: STALE_EVENT }),
      'invalid_invite',
    )
    await expectRowAbsent('team_members', { team_id: SECONDS, user_id: idOf('admin') })
  })

  it('unknown event raises invalid_invite', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRpcError(
      await aaron.rpc('join_team_by_event', { p_event_id: UNKNOWN_UUID }),
      'invalid_invite',
    )
    await expectRowAbsent('team_members', { team_id: SECONDS, user_id: idOf('playerFirsts') })
  })

  it('inactive team raises invalid_invite', async () => {
    const aaron = await signInAs('playerFirsts')
    await setTeamActive(SECONDS, false)
    try {
      expectRpcError(
        await aaron.rpc('join_team_by_event', { p_event_id: EVENT.seconds.far.id }),
        'invalid_invite',
      )
    } finally {
      await setTeamActive(SECONDS, true)
    }
    await expectRowAbsent('team_members', { team_id: SECONDS, user_id: idOf('playerFirsts') })
  })

  it('anon cannot execute join_team_by_event', async () => {
    expectNoExecute(
      await anonClient().rpc('join_team_by_event', { p_event_id: EVENT.seconds.far.id }),
    )
  })
})
