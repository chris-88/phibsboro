// Rows 34–36: set_member_role, remove_member, set_member_phone (D9, D33, D51). Admins change
// roles and numbers; managers remove players from their own teams; history survives removal.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createThrowaway,
  deleteAllInvites,
  deleteThrowaway,
  insertAttendance,
  insertMembership,
  insertResponse,
} from './helpers/arrange.ts'
import { anonClient, idOf, signInAs, signInWith } from './helpers/clients.ts'
import { EVENT, FIRSTS, FIXTURES, SECONDS } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectNoExecute,
  expectRowAbsent,
  expectRowUnchanged,
  expectRows,
  expectRpcError,
} from './helpers/expect.ts'

let leaving = { id: '', phone: '', password: '' } // a Firsts player with history, removed by Declan
let boss = { id: '', phone: '', password: '' } // a Firsts manager, removed by the admin
let renumbered = { id: '', phone: '', password: '' } // the set_member_phone subject

beforeAll(async () => {
  leaving = await createThrowaway(3, 'Leaving Player')
  boss = await createThrowaway(4, 'Second Manager')
  renumbered = await createThrowaway(5, 'Wrong Number')
  await insertMembership({ team_id: FIRSTS, user_id: leaving.id, role: 'player' })
  await insertMembership({ team_id: FIRSTS, user_id: boss.id, role: 'manager' })
  await insertMembership({ team_id: SECONDS, user_id: renumbered.id, role: 'player' })
  await insertResponse({
    event_id: EVENT.firsts.far.id,
    user_id: leaving.id,
    response: 'available',
  })
  await insertAttendance({
    event_id: EVENT.firsts.past.id,
    user_id: leaving.id,
    attended: true,
    recorded_by: idOf('managerFirsts'),
  })
})

afterAll(async () => {
  await deleteAllInvites() // row 34 mints and revokes one as the promoted Ian
  for (const user of [leaving, boss, renumbered]) if (user.id) await deleteThrowaway(user.id)
})

describe('row 34 — set_member_role', () => {
  const ian = () => ({ team_id: FIRSTS, user_id: idOf('playerFirstsAwaiting') })

  it('admin promotes a player to manager and demotes back', async () => {
    const admin = await signInAs('admin')
    const ianClient = await signInAs('playerFirstsAwaiting')
    const up = await admin.rpc('set_member_role', {
      p_team_id: FIRSTS,
      p_user_id: idOf('playerFirstsAwaiting'),
      p_role: 'manager',
    })
    expect(up.error).toBeNull()
    expect(
      expectRows(await ianClient.from('team_members').select('role').match(ian()), 1)[0],
    ).toEqual({ role: 'manager' })
    // A manager can now mint a player link; a player could not.
    expect(
      (await ianClient.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })).error,
    ).toBeNull()
    expect(
      (await ianClient.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' })).error,
    ).toBeNull()

    const down = await admin.rpc('set_member_role', {
      p_team_id: FIRSTS,
      p_user_id: idOf('playerFirstsAwaiting'),
      p_role: 'player',
    })
    expect(down.error).toBeNull()
    expect(
      expectRows(await ianClient.from('team_members').select('role').match(ian()), 1)[0],
    ).toEqual({ role: 'player' })
    expectRpcError(
      await ianClient.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
  })

  it('manager, player and stranger calling it raise not_authorised', async () => {
    const args = {
      p_team_id: FIRSTS,
      p_user_id: idOf('playerFirstsAwaiting'),
      p_role: 'manager' as const,
    }
    for (const fixture of ['managerFirsts', 'playerFirsts', 'stranger'] as const) {
      expectRpcError(await (await signInAs(fixture)).rpc('set_member_role', args), 'not_authorised')
    }
    await expectRowUnchanged('team_members', ian(), { role: 'player' })
  })

  it('a player cannot promote themselves through it', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRpcError(
      await aaron.rpc('set_member_role', {
        p_team_id: FIRSTS,
        p_user_id: idOf('playerFirsts'),
        p_role: 'manager',
      }),
      'not_authorised',
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: FIRSTS, user_id: idOf('playerFirsts') },
      { role: 'player' },
    )
  })

  it('anon cannot execute set_member_role', async () => {
    expectNoExecute(
      await anonClient().rpc('set_member_role', {
        p_team_id: FIRSTS,
        p_user_id: idOf('playerFirsts'),
        p_role: 'manager',
      }),
    )
  })
})

describe('row 35 — remove_member', () => {
  it('manager removing a co-manager raises not_authorised', async () => {
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('remove_member', { p_team_id: FIRSTS, p_user_id: boss.id }),
      'not_authorised',
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: FIRSTS, user_id: boss.id },
      { role: 'manager' },
    )
  })

  it("manager removing another team's player raises not_authorised", async () => {
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('remove_member', { p_team_id: SECONDS, p_user_id: renumbered.id }),
      'not_authorised',
    )
    expectRpcError(
      await declan.rpc('remove_member', { p_team_id: FIRSTS, p_user_id: renumbered.id }),
      'not_authorised',
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: SECONDS, user_id: renumbered.id },
      { role: 'player' },
    )
  })

  it('player and stranger raise not_authorised; anon cannot execute', async () => {
    const aaron = await signInAs('playerFirsts')
    const sean = await signInAs('stranger')
    expectRpcError(
      await aaron.rpc('remove_member', { p_team_id: FIRSTS, p_user_id: leaving.id }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('remove_member', { p_team_id: FIRSTS, p_user_id: leaving.id }),
      'not_authorised',
    )
    expectNoExecute(
      await anonClient().rpc('remove_member', { p_team_id: FIRSTS, p_user_id: leaving.id }),
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: FIRSTS, user_id: leaving.id },
      { role: 'player' },
    )
  })

  it('manager removes a player on their team; the responses and attendance stay (D33)', async () => {
    const declan = await signInAs('managerFirsts')
    const person = await signInWith(leaving.phone, leaving.password)
    expectRows(await person.from('teams').select('id').eq('id', FIRSTS), 1)

    const { error } = await declan.rpc('remove_member', {
      p_team_id: FIRSTS,
      p_user_id: leaving.id,
    })
    expect(error).toBeNull()
    await expectRowAbsent('team_members', { user_id: leaving.id })

    // Gone from the squad, out of the directory, but the history is theirs and the manager's still.
    expectEmpty(await person.from('teams').select('*'))
    const directory = expectRows(
      await declan.rpc('team_member_directory', { p_team_id: FIRSTS }),
      13,
    )
    expect(directory.some((r) => r.user_id === leaving.id)).toBe(false)
    expect(
      expectRows(await person.from('event_responses').select('event_id, response'), 1)[0],
    ).toEqual({
      event_id: EVENT.firsts.far.id,
      response: 'available',
    })
    expect(expectRows(await person.from('attendance').select('event_id, attended'), 1)[0]).toEqual({
      event_id: EVENT.firsts.past.id,
      attended: true,
    })
    expectRows(await person.from('events').select('id'), 2)
    expectRows(
      await declan
        .from('event_responses')
        .select('*')
        .match({ event_id: EVENT.firsts.far.id, user_id: leaving.id }),
      1,
    )
    expectRows(
      await declan
        .from('attendance')
        .select('*')
        .match({ event_id: EVENT.firsts.past.id, user_id: leaving.id }),
      1,
    )
  })

  it('admin removes a manager', async () => {
    const admin = await signInAs('admin')
    const { error } = await admin.rpc('remove_member', { p_team_id: FIRSTS, p_user_id: boss.id })
    expect(error).toBeNull()
    await expectRowAbsent('team_members', { user_id: boss.id })
  })
})

describe('row 36 — set_member_phone (D51)', () => {
  const NEW_PHONE = '+353899997799'

  it('manager, player and stranger raise not_authorised; anon cannot execute', async () => {
    for (const fixture of ['managerSeconds', 'playerFirsts', 'stranger'] as const) {
      const client = await signInAs(fixture)
      expectRpcError(
        await client.rpc('set_member_phone', { p_user_id: renumbered.id, p_phone: NEW_PHONE }),
        'not_authorised',
      )
    }
    expectNoExecute(
      await anonClient().rpc('set_member_phone', { p_user_id: renumbered.id, p_phone: NEW_PHONE }),
    )
    await expectRowUnchanged('profiles', { id: renumbered.id }, { phone: renumbered.phone })
  })

  it('a number already held by someone else raises phone_taken, not a unique-violation string', async () => {
    const admin = await signInAs('admin')
    const res = await admin.rpc('set_member_phone', {
      p_user_id: renumbered.id,
      p_phone: FIXTURES.playerFirsts.phone,
    })
    expectRpcError(res, 'phone_taken')
    expect(res.error?.message).not.toMatch(/duplicate key|unique/)
    await expectRowUnchanged('profiles', { id: renumbered.id }, { phone: renumbered.phone })
    await expectRowUnchanged(
      'profiles',
      { id: idOf('playerFirsts') },
      { phone: FIXTURES.playerFirsts.phone },
    )
  })

  it('a malformed number raises not_authorised', async () => {
    const admin = await signInAs('admin')
    expectRpcError(
      await admin.rpc('set_member_phone', { p_user_id: renumbered.id, p_phone: '0871234567' }),
      'not_authorised',
    )
    await expectRowUnchanged('profiles', { id: renumbered.id }, { phone: renumbered.phone })
  })

  it('admin corrects a number, and the user signs in with the new one and not the old', async () => {
    const admin = await signInAs('admin')
    const { error } = await admin.rpc('set_member_phone', {
      p_user_id: renumbered.id,
      p_phone: NEW_PHONE,
    })
    expect(error).toBeNull()
    const moved = await signInWith(NEW_PHONE, renumbered.password)
    const profile = expectRows(await moved.from('profiles').select('id, phone'), 1)
    expect(profile[0]).toEqual({ id: renumbered.id, phone: NEW_PHONE })
    const old = await anonClient().auth.signInWithPassword({
      phone: renumbered.phone,
      password: renumbered.password,
    })
    expect(old.error?.code).toBe('invalid_credentials')
  })
})
