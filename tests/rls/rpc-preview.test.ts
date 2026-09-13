// Rows 24–26: get_event_preview (D7), lookup_team_invite (D28) and team_member_directory (D8).
// Lookups return zero rows on every failure and never raise, so nothing can be probed.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { deleteAllInvites, expireInvite, setTeamActive } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { EVENT, FIRSTS, FIXTURES, SECONDS, SQUAD_SIZE, UNKNOWN_UUID } from './helpers/fixtures.ts'
import { expectEmpty, expectNoExecute, expectRows, expectTokenShape } from './helpers/expect.ts'

const PREVIEW_KEYS = ['location', 'starts_at', 'status', 'team_id', 'team_name', 'title', 'type']

describe('row 24 — get_event_preview', () => {
  it('anon gets one row for a real event, with no notes and no created_by', async () => {
    const rows = expectRows(
      await anonClient().rpc('get_event_preview', { p_event_id: EVENT.firsts.imminent.id }),
      1,
    )
    const row = rows[0]
    expect(Object.keys(row ?? {}).sort()).toEqual(PREVIEW_KEYS)
    expect(row).toMatchObject({
      team_id: FIRSTS,
      team_name: 'Firsts',
      type: 'training',
      title: EVENT.firsts.imminent.title,
      location: EVENT.firsts.imminent.location,
      status: 'scheduled',
    })
    expect(row).not.toHaveProperty('notes')
    expect(row).not.toHaveProperty('created_by')
  })

  it('stranger gets one row too, for an event of a team they are not in', async () => {
    const sean = await signInAs('stranger')
    const rows = expectRows(
      await sean.rpc('get_event_preview', { p_event_id: EVENT.seconds.far.id }),
      1,
    )
    expect(rows[0]).toMatchObject({ team_id: SECONDS, team_name: 'Seconds', status: 'scheduled' })
  })

  it('a cancelled event previews as cancelled, and admin previews like anyone else', async () => {
    const admin = await signInAs('admin')
    const rows = expectRows(
      await admin.rpc('get_event_preview', { p_event_id: EVENT.firsts.cancelled.id }),
      1,
    )
    expect(rows[0]).toMatchObject({ status: 'cancelled' })
  })

  it('unknown uuid returns zero rows and no error, for anon and signed in alike', async () => {
    expectEmpty(await anonClient().rpc('get_event_preview', { p_event_id: UNKNOWN_UUID }))
    const aaron = await signInAs('playerFirsts')
    expectEmpty(await aaron.rpc('get_event_preview', { p_event_id: UNKNOWN_UUID }))
  })
})

describe('row 25 — lookup_team_invite', () => {
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
  })

  afterAll(async () => {
    await setTeamActive(SECONDS, true)
    await deleteAllInvites()
  })

  it('valid player token returns team name and role to anon', async () => {
    const rows = expectRows(
      await anonClient().rpc('lookup_team_invite', { p_token: playerToken }),
      1,
    )
    expect(rows[0]).toEqual({ team_id: FIRSTS, team_name: 'Firsts', role: 'player' })
  })

  it('valid manager token returns role manager to a signed-in stranger', async () => {
    const sean = await signInAs('stranger')
    const rows = expectRows(await sean.rpc('lookup_team_invite', { p_token: managerToken }), 1)
    expect(rows[0]).toEqual({ team_id: SECONDS, team_name: 'Seconds', role: 'manager' })
  })

  it('unknown token returns zero rows and no error', async () => {
    expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: 'x'.repeat(43) }))
    expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: '' }))
  })

  it('inactive-team token returns zero rows while the team is inactive', async () => {
    await setTeamActive(SECONDS, false)
    try {
      expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: managerToken }))
    } finally {
      await setTeamActive(SECONDS, true)
    }
    expectRows(await anonClient().rpc('lookup_team_invite', { p_token: managerToken }), 1)
  })

  it('expired token returns zero rows', async () => {
    await expireInvite(managerToken)
    expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: managerToken }))
  })

  it('revoked token returns zero rows', async () => {
    const admin = await signInAs('admin')
    const { error } = await admin.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
    expect(error).toBeNull()
    expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: playerToken }))
  })
})

describe('row 26 — team_member_directory', () => {
  it('member gets every name on their team with phone null', async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(
      await aaron.rpc('team_member_directory', { p_team_id: FIRSTS }),
      SQUAD_SIZE,
    )
    expect(rows.map((r) => r.phone)).toEqual(rows.map(() => null))
    expect(rows.map((r) => r.name)).toContain(FIXTURES.playerFirstsOther.name)
    expect(rows.find((r) => r.user_id === idOf('managerFirsts'))).toMatchObject({
      name: FIXTURES.managerFirsts.name,
      role: 'manager',
      phone: null,
    })
  })

  it('manager of that team gets phone populated on every row', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(
      await declan.rpc('team_member_directory', { p_team_id: FIRSTS }),
      SQUAD_SIZE,
    )
    expect(rows.every((r) => typeof r.phone === 'string' && r.phone.startsWith('+353'))).toBe(true)
    expect(rows.find((r) => r.user_id === idOf('playerFirsts'))?.phone).toBe(
      FIXTURES.playerFirsts.phone,
    )
  })

  it('a manager who is only a player on the other team gets phone null there', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(
      await declan.rpc('team_member_directory', { p_team_id: SECONDS }),
      SQUAD_SIZE,
    )
    expect(rows.map((r) => r.phone)).toEqual(rows.map(() => null))
  })

  it('admin gets phones for a team they are not a member of', async () => {
    const admin = await signInAs('admin')
    const rows = expectRows(
      await admin.rpc('team_member_directory', { p_team_id: SECONDS }),
      SQUAD_SIZE,
    )
    expect(rows.every((r) => typeof r.phone === 'string')).toBe(true)
  })

  it('non-member gets zero rows: a Seconds player, a Seconds manager, the stranger', async () => {
    const liam = await signInAs('playerSeconds')
    const niamh = await signInAs('managerSeconds')
    const sean = await signInAs('stranger')
    expectEmpty(await liam.rpc('team_member_directory', { p_team_id: FIRSTS }))
    expectEmpty(await niamh.rpc('team_member_directory', { p_team_id: FIRSTS }))
    expectEmpty(await sean.rpc('team_member_directory', { p_team_id: FIRSTS }))
    expectEmpty(await sean.rpc('team_member_directory', { p_team_id: SECONDS }))
  })

  it('anon cannot execute team_member_directory', async () => {
    expectNoExecute(await anonClient().rpc('team_member_directory', { p_team_id: FIRSTS }))
  })
})
