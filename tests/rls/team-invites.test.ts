// Row 39's second half for team_invites: the table is reachable through RPCs only. No role can
// select, insert, update or delete a row, so no token ever reaches a client any other way (D5, D62).
import { afterAll, describe, it } from 'vitest'

import { deleteAllInvites } from './helpers/arrange.ts'
import { anonClient, signInAs } from './helpers/clients.ts'
import { FIRSTS } from './helpers/fixtures.ts'
import { expectRlsDenied, expectRowAbsent } from './helpers/expect.ts'

afterAll(deleteAllInvites)

const roles = ['playerFirsts', 'managerFirsts', 'admin', 'stranger'] as const

describe('team_invites — deny all', () => {
  it('anon cannot select token from team_invites', async () => {
    expectRlsDenied(await anonClient().from('team_invites').select('token'))
  })

  it.each(roles)('%s cannot select token from team_invites', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(await client.from('team_invites').select('token'))
    // Never head: true here — a HEAD response has no body, so the 42501 would be unreadable.
    expectRlsDenied(await client.from('team_invites').select('*', { count: 'exact' }))
  })

  it.each(roles)('%s cannot insert an invite', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(
      await client
        .from('team_invites')
        .insert({ team_id: FIRSTS, token: 'forged-token-rls', role: 'manager' })
        .select(),
    )
    await expectRowAbsent('team_invites', { token: 'forged-token-rls' })
  })

  it.each(roles)('%s cannot update or delete invites', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(
      await client.from('team_invites').update({ active: true }).eq('team_id', FIRSTS).select(),
    )
    expectRlsDenied(await client.from('team_invites').delete().eq('team_id', FIRSTS).select())
  })

  it('anon cannot insert, update or delete invites', async () => {
    const anon = anonClient()
    expectRlsDenied(
      await anon
        .from('team_invites')
        .insert({ team_id: FIRSTS, token: 'forged-token-anon', role: 'player' })
        .select(),
    )
    expectRlsDenied(
      await anon.from('team_invites').update({ active: false }).eq('team_id', FIRSTS).select(),
    )
    expectRlsDenied(await anon.from('team_invites').delete().eq('team_id', FIRSTS).select())
    await expectRowAbsent('team_invites', { token: 'forged-token-anon' })
  })
})
