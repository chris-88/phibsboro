// S20.3 (feedback #4, Z2) — player_injuries. A row means the player is currently injured. Writes go
// through set_injury / clear_injury (self, a manager of the player's team, or an admin); reads are
// direct and RLS-scoped to the same audience. Informational only — nothing here touches availability.
import { afterAll, describe, expect, it } from 'vitest'

import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { expectEmpty, expectNoExecute, expectRows, expectRpcError } from './helpers/expect.ts'

const injuredRow = (userId: string) => (client: Awaited<ReturnType<typeof signInAs>>) =>
  client.from('player_injuries').select('user_id').eq('user_id', userId)

afterAll(async () => {
  // Clear anything a test left set, so the seed is untouched for the next run.
  const admin = await signInAs('admin')
  for (const f of ['playerFirsts', 'playerFirstsOther', 'playerSeconds'] as const) {
    await admin.rpc('clear_injury', { p_user_id: idOf(f) })
  }
})

describe('set_injury / clear_injury (S20.3, Z2)', () => {
  it('a manager marks a player on their team injured, and a player marks themselves', async () => {
    const declan = await signInAs('managerFirsts')
    expect(
      (
        await declan.rpc('set_injury', {
          p_user_id: idOf('playerFirsts'),
          p_expected_return: '2026-11-01',
          p_note: 'hamstring',
        })
      ).error,
    ).toBeNull()

    const aaron = await signInAs('playerFirsts')
    expect((await aaron.rpc('set_injury', { p_user_id: idOf('playerFirsts') })).error).toBeNull()
    expectRows(await injuredRow(idOf('playerFirsts'))(aaron), 1)
  })

  it('refuses a manager of another team, a player marking someone else, and a stranger; anon cannot execute', async () => {
    // Declan manages Firsts and only plays Seconds, so he may not mark a Seconds player.
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('set_injury', { p_user_id: idOf('playerSeconds') }),
      'not_authorised',
    )
    const aaron = await signInAs('playerFirsts')
    expectRpcError(
      await aaron.rpc('set_injury', { p_user_id: idOf('playerFirstsOther') }),
      'not_authorised',
    )
    const sean = await signInAs('stranger')
    expectRpcError(
      await sean.rpc('set_injury', { p_user_id: idOf('playerFirsts') }),
      'not_authorised',
    )
    expectNoExecute(await anonClient().rpc('set_injury', { p_user_id: idOf('playerFirsts') }))
  })

  it('clear_injury removes the row (admin), and a player cannot clear someone else', async () => {
    const admin = await signInAs('admin')
    expect(
      (await admin.rpc('set_injury', { p_user_id: idOf('playerFirstsOther') })).error,
    ).toBeNull()
    expect(
      (await admin.rpc('clear_injury', { p_user_id: idOf('playerFirstsOther') })).error,
    ).toBeNull()
    expectEmpty(await injuredRow(idOf('playerFirstsOther'))(admin))

    const aaron = await signInAs('playerFirsts')
    expectRpcError(
      await aaron.rpc('clear_injury', { p_user_id: idOf('playerFirstsOther') }),
      'not_authorised',
    )
  })
})

describe('player_injuries select policy (S20.3)', () => {
  it('self and a team manager read it; a teammate and a manager of another team cannot', async () => {
    const admin = await signInAs('admin')
    await admin.rpc('set_injury', { p_user_id: idOf('playerFirsts'), p_note: 'knock' })

    const aaron = await signInAs('playerFirsts')
    expectRows(await injuredRow(idOf('playerFirsts'))(aaron), 1)

    const declan = await signInAs('managerFirsts')
    expectRows(await injuredRow(idOf('playerFirsts'))(declan), 1)

    // A teammate who does not manage the team cannot read another player's injury.
    const ben = await signInAs('playerFirstsOther')
    expectEmpty(await injuredRow(idOf('playerFirsts'))(ben))

    // A manager of a different team cannot either.
    const niamh = await signInAs('managerSeconds')
    expectEmpty(await injuredRow(idOf('playerFirsts'))(niamh))
  })
})
