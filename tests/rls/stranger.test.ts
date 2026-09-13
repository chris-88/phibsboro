// Row 38 / AC7: the fourth role (D37). A signed-in account with zero memberships reaches
// get_event_preview, lookup_team_invite and the two join RPCs, and nothing else: empty or refused
// on all eight tables and on every other RPC. The positive joins are in rpc-join.test.ts.
import { describe, expect, it } from 'vitest'

import { idOf, signInAs } from './helpers/clients.ts'
import { EVENT, FIRSTS, UNKNOWN_UUID } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectRlsDenied,
  expectRowAbsent,
  expectRowCount,
  expectRowUnchanged,
  expectRows,
  expectRpcError,
} from './helpers/expect.ts'

describe('stranger — tables', () => {
  it('reads only their own profiles row, and nothing from the other seven tables', async () => {
    const sean = await signInAs('stranger')
    expectRows(await sean.from('profiles').select('id'), 1)
    expectEmpty(await sean.from('teams').select('*', { count: 'exact' }))
    expectEmpty(await sean.from('team_members').select('*', { count: 'exact' }))
    expectEmpty(await sean.from('events').select('*', { count: 'exact' }))
    expectEmpty(await sean.from('event_responses').select('*', { count: 'exact' }))
    expectEmpty(await sean.from('attendance').select('*', { count: 'exact' }))
    expectRlsDenied(await sean.from('team_invites').select('*'))
    expectRlsDenied(await sean.from('reset_tokens').select('*'))
  })

  it('is refused every insert', async () => {
    const sean = await signInAs('stranger')
    const me = idOf('stranger')
    expectRlsDenied(
      await sean
        .from('profiles')
        .insert({ id: UNKNOWN_UUID, name: 'x', phone: '+353899997790' })
        .select(),
    )
    expectRlsDenied(await sean.from('teams').insert({ name: 'Strangers' }).select())
    expectRlsDenied(
      await sean
        .from('team_members')
        .insert({ team_id: FIRSTS, user_id: me, role: 'player' })
        .select(),
    )
    expectRlsDenied(
      await sean
        .from('events')
        .insert({
          team_id: FIRSTS,
          type: 'match',
          title: 'x',
          location: 'x',
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .select(),
    )
    expectRlsDenied(
      await sean
        .from('event_responses')
        .insert({ event_id: EVENT.firsts.imminent.id, user_id: me, response: 'available' })
        .select(),
    )
    expectRlsDenied(
      await sean
        .from('attendance')
        .insert({ event_id: EVENT.firsts.past.id, user_id: me, attended: true, recorded_by: me })
        .select(),
    )
    expectRlsDenied(
      await sean
        .from('team_invites')
        .insert({ team_id: FIRSTS, token: 'stranger-forged', role: 'player' })
        .select(),
    )
    expectRlsDenied(
      await sean
        .from('reset_tokens')
        .insert({ user_id: me, team_id: FIRSTS, token: 'stranger-forged' })
        .select(),
    )
    await expectRowAbsent('team_members', { user_id: me })
    await expectRowAbsent('event_responses', { user_id: me })
    await expectRowAbsent('attendance', { user_id: me })
    await expectRowAbsent('team_invites', { token: 'stranger-forged' })
    await expectRowAbsent('reset_tokens', { token: 'stranger-forged' })
  })

  it('updates and deletes touch nothing or are refused', async () => {
    const sean = await signInAs('stranger')
    expectRlsDenied(
      await sean.from('profiles').update({ name: 'x' }).eq('id', idOf('stranger')).select(),
    )
    expectEmpty(await sean.from('teams').update({ name: 'x' }).eq('id', FIRSTS).select())
    expectRlsDenied(await sean.from('teams').delete().eq('id', FIRSTS).select())
    expectRlsDenied(
      await sean.from('team_members').update({ role: 'manager' }).eq('team_id', FIRSTS).select(),
    )
    expectEmpty(
      await sean.from('events').update({ title: 'x' }).eq('id', EVENT.firsts.far.id).select(),
    )
    expectEmpty(await sean.from('events').delete().eq('id', EVENT.firsts.far.id).select())
    expectEmpty(
      await sean
        .from('event_responses')
        .update({ response: 'unavailable' })
        .eq('event_id', EVENT.firsts.far.id)
        .select(),
    )
    expectEmpty(
      await sean.from('event_responses').delete().eq('event_id', EVENT.firsts.far.id).select(),
    )
    expectEmpty(
      await sean
        .from('attendance')
        .update({ attended: false })
        .eq('event_id', EVENT.firsts.past.id)
        .select(),
    )
    expectEmpty(
      await sean.from('attendance').delete().eq('event_id', EVENT.firsts.past.id).select(),
    )
    expectRlsDenied(
      await sean.from('team_invites').update({ active: false }).eq('team_id', FIRSTS).select(),
    )
    expectRlsDenied(await sean.from('reset_tokens').delete().eq('team_id', FIRSTS).select())
    // The filtered writes above returned [] because `using` hid every row; prove nothing moved.
    const ben = idOf('playerFirstsOther')
    await expectRowUnchanged('teams', { id: FIRSTS }, { name: 'Firsts' })
    await expectRowUnchanged(
      'events',
      { id: EVENT.firsts.far.id },
      { title: EVENT.firsts.far.title, status: 'scheduled' },
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.far.id, user_id: ben },
      { response: 'available' },
    )
    await expectRowUnchanged(
      'attendance',
      { event_id: EVENT.firsts.past.id, user_id: ben },
      { attended: true },
    )
    await expectRowCount('event_responses', { event_id: EVENT.firsts.far.id }, 3)
    await expectRowCount('attendance', { event_id: EVENT.firsts.past.id }, 9)
  })
})

describe('stranger — RPCs', () => {
  it('reaches get_event_preview and lookup_team_invite', async () => {
    const sean = await signInAs('stranger')
    expectRows(await sean.rpc('get_event_preview', { p_event_id: EVENT.firsts.imminent.id }), 1)
    expectEmpty(await sean.rpc('lookup_team_invite', { p_token: 'no-such-token' }))
  })

  it('is empty or refused on every other RPC', async () => {
    const sean = await signInAs('stranger')
    const me = idOf('stranger')
    expectEmpty(await sean.rpc('team_member_directory', { p_team_id: FIRSTS }))
    expectEmpty(await sean.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }))
    expectRpcError(
      await sean.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('issue_reset_token', { p_user_id: me, p_team_id: FIRSTS }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('redeem_reset_token', {
        p_token: 'no-such-token',
        p_new_password: 'longenough',
      }),
      'invalid_token',
    )
    expectRpcError(
      await sean.rpc('set_member_role', { p_team_id: FIRSTS, p_user_id: me, p_role: 'manager' }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('remove_member', { p_team_id: FIRSTS, p_user_id: idOf('playerFirsts') }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('set_member_phone', { p_user_id: me, p_phone: '+353899997790' }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('generate_training_series', {
        p_team_id: FIRSTS,
        p_first_starts_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        p_weeks: 2,
        p_title: 'x',
        p_location: 'x',
      }),
      'not_authorised',
    )
    await expectRowAbsent('team_members', { user_id: me })
    expect((await sean.rpc('is_admin')).data).toBe(false)
    expect((await sean.rpc('is_team_member', { p_team_id: FIRSTS })).data).toBe(false)
    expect((await sean.rpc('is_team_manager', { p_team_id: FIRSTS })).data).toBe(false)
  })
})
