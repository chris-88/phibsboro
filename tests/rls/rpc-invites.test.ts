// Rows 30, 31, 31a and 39: create_team_invite, revoke_team_invite, get_team_invite (D28, D29,
// D62). A manager mints and re-copies player links for their teams; only an admin touches
// manager links; tokens are 43 characters of base64url and never repeat.
import { afterAll, describe, expect, it } from 'vitest'

import { deleteAllInvites, expireInvite, setTeamActive } from './helpers/arrange.ts'
import { anonClient, signInAs } from './helpers/clients.ts'
import { FIRSTS, SECONDS } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectNoExecute,
  expectRows,
  expectRpcError,
  expectTokenShape,
} from './helpers/expect.ts'

afterAll(async () => {
  await setTeamActive(FIRSTS, true)
  await deleteAllInvites()
})

const hoursUntil = (iso: string) => (new Date(iso).getTime() - Date.now()) / 3_600_000

describe('row 30 / 39 — create_team_invite', () => {
  it('manager mints a player invite: 43 characters of [A-Za-z0-9_-], expiring in 90 days', async () => {
    const declan = await signInAs('managerFirsts')
    const { data, error } = await declan.rpc('create_team_invite', {
      p_team_id: FIRSTS,
      p_role: 'player',
    })
    expect(error).toBeNull()
    expectTokenShape(data)
    const rows = expectRows(await anonClient().rpc('lookup_team_invite', { p_token: data }), 1)
    expect(rows[0]).toEqual({ team_id: FIRSTS, team_name: 'Firsts', role: 'player' })
    const live = expectRows(
      await declan.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      1,
    )
    expect(live[0]?.token).toBe(data)
    expect(hoursUntil(live[0]?.expires_at ?? '')).toBeGreaterThan(89 * 24)
    expect(hoursUntil(live[0]?.expires_at ?? '')).toBeLessThanOrEqual(90 * 24)
  })

  it('two consecutive mints return different tokens, and the first then looks up to zero rows', async () => {
    const declan = await signInAs('managerFirsts')
    const first = await declan.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
    const second = await declan.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
    expectTokenShape(first.data)
    expectTokenShape(second.data)
    expect(first.data).not.toBe(second.data)
    expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: first.data }))
    expectRows(await anonClient().rpc('lookup_team_invite', { p_token: second.data }), 1)
    const live = expectRows(
      await declan.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      1,
    )
    expect(live[0]?.token).toBe(second.data)
  })

  it('admin mints either role, and a manager link expires within 24 hours', async () => {
    const admin = await signInAs('admin')
    const player = await admin.rpc('create_team_invite', { p_team_id: SECONDS, p_role: 'player' })
    const manager = await admin.rpc('create_team_invite', { p_team_id: SECONDS, p_role: 'manager' })
    expectTokenShape(player.data)
    expectTokenShape(manager.data)
    expect(player.data).not.toBe(manager.data)
    const live = expectRows(
      await admin.rpc('get_team_invite', { p_team_id: SECONDS, p_role: 'manager' }),
      1,
    )
    expect(live[0]).toMatchObject({ token: manager.data, role: 'manager' })
    expect(hoursUntil(live[0]?.expires_at ?? '')).toBeGreaterThan(23)
    expect(hoursUntil(live[0]?.expires_at ?? '')).toBeLessThanOrEqual(24)
  })

  it('manager minting a manager invite raises not_authorised', async () => {
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'manager' }),
      'not_authorised',
    )
  })

  it('manager minting for a team they merely play for raises not_authorised', async () => {
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('create_team_invite', { p_team_id: SECONDS, p_role: 'player' }),
      'not_authorised',
    )
  })

  it('player and stranger minting anything raise not_authorised', async () => {
    const aaron = await signInAs('playerFirsts')
    const sean = await signInAs('stranger')
    expectRpcError(
      await aaron.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
    expectRpcError(
      await aaron.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'manager' }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
  })

  it('minting for an inactive team raises not_authorised, for manager and admin alike (D50)', async () => {
    const declan = await signInAs('managerFirsts')
    const admin = await signInAs('admin')
    await setTeamActive(FIRSTS, false)
    try {
      expectRpcError(
        await declan.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
        'not_authorised',
      )
      expectRpcError(
        await admin.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
        'not_authorised',
      )
    } finally {
      await setTeamActive(FIRSTS, true)
    }
  })

  it('anon cannot execute create_team_invite', async () => {
    expectNoExecute(
      await anonClient().rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
    )
  })
})

describe('row 31a — get_team_invite', () => {
  it('player, stranger and the other manager each get zero rows and no error', async () => {
    const declan = await signInAs('managerFirsts')
    const minted = await declan.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
    expectTokenShape(minted.data)
    for (const fixture of ['playerFirsts', 'stranger', 'managerSeconds'] as const) {
      const client = await signInAs(fixture)
      expectEmpty(await client.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }))
    }
  })

  it('a manager asking for the manager role gets zero rows, admin gets it', async () => {
    const admin = await signInAs('admin')
    const niamh = await signInAs('managerSeconds')
    expectRows(await admin.rpc('get_team_invite', { p_team_id: SECONDS, p_role: 'manager' }), 1)
    expectEmpty(await niamh.rpc('get_team_invite', { p_team_id: SECONDS, p_role: 'manager' }))
    expectRows(await niamh.rpc('get_team_invite', { p_team_id: SECONDS, p_role: 'player' }), 1)
  })

  it('an expired invite returns zero rows', async () => {
    const declan = await signInAs('managerFirsts')
    const live = expectRows(
      await declan.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      1,
    )
    await expireInvite(live[0]?.token ?? '')
    expectEmpty(await declan.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }))
  })

  it('anon cannot execute get_team_invite', async () => {
    expectNoExecute(
      await anonClient().rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
    )
  })
})

describe('row 31 — revoke_team_invite', () => {
  it("manager revokes their team's player invite; it looks up to zero rows at once; memberships survive", async () => {
    const declan = await signInAs('managerFirsts')
    const aaron = await signInAs('playerFirsts')
    const minted = await declan.rpc('create_team_invite', { p_team_id: FIRSTS, p_role: 'player' })
    expectTokenShape(minted.data)
    expectRows(await anonClient().rpc('lookup_team_invite', { p_token: minted.data }), 1)
    const { data, error } = await declan.rpc('revoke_team_invite', {
      p_team_id: FIRSTS,
      p_role: 'player',
    })
    expect(error).toBeNull()
    expect(data).toBeNull()
    expectEmpty(await anonClient().rpc('lookup_team_invite', { p_token: minted.data }))
    expectEmpty(await declan.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }))
    expectRows(await aaron.from('teams').select('id').eq('id', FIRSTS), 1)
  })

  it('a revoked invite returns zero rows from get_team_invite', async () => {
    const declan = await signInAs('managerFirsts')
    expectEmpty(await declan.rpc('get_team_invite', { p_team_id: FIRSTS, p_role: 'player' }))
  })

  it('player, stranger, the other manager and a manager revoking the manager role each raise not_authorised', async () => {
    const aaron = await signInAs('playerFirsts')
    const sean = await signInAs('stranger')
    const niamh = await signInAs('managerSeconds')
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await aaron.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
    expectRpcError(
      await sean.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
    expectRpcError(
      await niamh.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
      'not_authorised',
    )
    expectRpcError(
      await declan.rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'manager' }),
      'not_authorised',
    )
  })

  it('admin revokes a manager invite', async () => {
    const admin = await signInAs('admin')
    expectRows(await admin.rpc('get_team_invite', { p_team_id: SECONDS, p_role: 'manager' }), 1)
    expect(
      (await admin.rpc('revoke_team_invite', { p_team_id: SECONDS, p_role: 'manager' })).error,
    ).toBeNull()
    expectEmpty(await admin.rpc('get_team_invite', { p_team_id: SECONDS, p_role: 'manager' }))
  })

  it('anon cannot execute revoke_team_invite', async () => {
    expectNoExecute(
      await anonClient().rpc('revoke_team_invite', { p_team_id: FIRSTS, p_role: 'player' }),
    )
  })
})
