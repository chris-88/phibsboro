// Row 8 and the team_members cells of rows 38 and 40. Read within your teams; no client write of
// any kind, including a player promoting themselves (D9).
import { describe, expect, it } from 'vitest'

import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { FIRSTS, SECONDS, SQUAD_SIZE } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectRlsDenied,
  expectRowAbsent,
  expectRowUnchanged,
  expectRows,
} from './helpers/expect.ts'

describe('row 8 — team_members select', () => {
  it("player selects their team's rows: twelve, all Firsts", async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(
      await aaron.from('team_members').select('team_id, user_id, role'),
      SQUAD_SIZE,
    )
    expect(rows.every((r) => r.team_id === FIRSTS)).toBe(true)
    expect(rows.filter((r) => r.role === 'manager')).toHaveLength(1)
    expect(rows.some((r) => r.user_id === idOf('playerFirsts'))).toBe(true)
  })

  it('player selects nothing for another team', async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(
      await aaron.from('team_members').select('*', { count: 'exact' }).eq('team_id', SECONDS),
    )
    expectEmpty(await aaron.from('team_members').select('*').eq('user_id', idOf('playerSeconds')))
  })

  it('manager who plays for the other team selects both squads', async () => {
    const declan = await signInAs('managerFirsts')
    expectRows(await declan.from('team_members').select('team_id'), SQUAD_SIZE * 2)
  })

  it('admin selects every row without a membership', async () => {
    const admin = await signInAs('admin')
    const rows = expectRows(await admin.from('team_members').select('team_id'), SQUAD_SIZE * 2)
    expect(rows.filter((r) => r.team_id === SECONDS)).toHaveLength(SQUAD_SIZE)
  })

  it('stranger selects nothing (D37)', async () => {
    const sean = await signInAs('stranger')
    expectEmpty(await sean.from('team_members').select('*', { count: 'exact' }))
  })

  it('anon cannot select team_members', async () => {
    expectRlsDenied(await anonClient().from('team_members').select('*'))
  })
})

describe('row 8 — team_members has no client write path (D9)', () => {
  it('player cannot insert themselves into another team', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('team_members')
        .insert({ team_id: SECONDS, user_id: idOf('playerFirsts'), role: 'player' })
        .select(),
    )
    await expectRowAbsent('team_members', { team_id: SECONDS, user_id: idOf('playerFirsts') })
  })

  it('player cannot promote themselves to manager', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('team_members')
        .update({ role: 'manager' })
        .match({ team_id: FIRSTS, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: FIRSTS, user_id: idOf('playerFirsts') },
      { role: 'player' },
    )
  })

  it('player cannot delete a membership, their own included', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('team_members')
        .delete()
        .match({ team_id: FIRSTS, user_id: idOf('playerFirsts') })
        .select(),
    )
    expectRlsDenied(
      await aaron
        .from('team_members')
        .delete()
        .match({ team_id: FIRSTS, user_id: idOf('playerFirstsOther') })
        .select(),
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: FIRSTS, user_id: idOf('playerFirstsOther') },
      { role: 'player' },
    )
  })

  it('manager cannot insert, update or delete on their own team', async () => {
    const declan = await signInAs('managerFirsts')
    expectRlsDenied(
      await declan
        .from('team_members')
        .insert({ team_id: FIRSTS, user_id: idOf('stranger'), role: 'player' })
        .select(),
    )
    await expectRowAbsent('team_members', { team_id: FIRSTS, user_id: idOf('stranger') })
    expectRlsDenied(
      await declan
        .from('team_members')
        .update({ role: 'manager' })
        .match({ team_id: FIRSTS, user_id: idOf('playerFirsts') })
        .select(),
    )
    expectRlsDenied(
      await declan
        .from('team_members')
        .delete()
        .match({ team_id: FIRSTS, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: FIRSTS, user_id: idOf('playerFirsts') },
      { role: 'player' },
    )
  })

  it('admin cannot write team_members directly either: the RPCs are the only path', async () => {
    const admin = await signInAs('admin')
    expectRlsDenied(
      await admin
        .from('team_members')
        .insert({ team_id: FIRSTS, user_id: idOf('admin'), role: 'manager' })
        .select(),
    )
    await expectRowAbsent('team_members', { team_id: FIRSTS, user_id: idOf('admin') })
    expectRlsDenied(
      await admin
        .from('team_members')
        .update({ role: 'manager' })
        .match({ team_id: FIRSTS, user_id: idOf('playerFirsts') })
        .select(),
    )
    expectRlsDenied(
      await admin
        .from('team_members')
        .delete()
        .match({ team_id: FIRSTS, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'team_members',
      { team_id: FIRSTS, user_id: idOf('playerFirsts') },
      { role: 'player' },
    )
  })

  it('stranger cannot insert themselves anywhere', async () => {
    const sean = await signInAs('stranger')
    expectRlsDenied(
      await sean
        .from('team_members')
        .insert({ team_id: FIRSTS, user_id: idOf('stranger'), role: 'player' })
        .select(),
    )
    await expectRowAbsent('team_members', { user_id: idOf('stranger') })
  })

  it('anon cannot insert, update or delete team_members', async () => {
    const anon = anonClient()
    expectRlsDenied(
      await anon
        .from('team_members')
        .insert({ team_id: FIRSTS, user_id: idOf('stranger'), role: 'player' })
        .select(),
    )
    expectRlsDenied(
      await anon.from('team_members').update({ role: 'manager' }).eq('team_id', FIRSTS).select(),
    )
    expectRlsDenied(await anon.from('team_members').delete().eq('team_id', FIRSTS).select())
  })
})
