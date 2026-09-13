// Row 39's second half for reset_tokens: reachable through RPCs only. No role can select, insert,
// update or delete a row (D5, D62).
import { afterAll, describe, it } from 'vitest'

import { deleteAllResetTokens } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { FIRSTS } from './helpers/fixtures.ts'
import { expectRlsDenied, expectRowAbsent } from './helpers/expect.ts'

afterAll(deleteAllResetTokens)

const roles = ['playerFirsts', 'managerFirsts', 'admin', 'stranger'] as const

describe('reset_tokens — deny all', () => {
  it('anon cannot select token from reset_tokens', async () => {
    expectRlsDenied(await anonClient().from('reset_tokens').select('token'))
  })

  it.each(roles)('%s cannot select token from reset_tokens', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(await client.from('reset_tokens').select('token'))
    // Never head: true here — a HEAD response has no body, so the 42501 would be unreadable.
    expectRlsDenied(await client.from('reset_tokens').select('*', { count: 'exact' }))
  })

  it.each(roles)('%s cannot insert a reset token', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(
      await client
        .from('reset_tokens')
        .insert({ user_id: idOf('playerFirsts'), team_id: FIRSTS, token: 'forged-reset-rls' })
        .select(),
    )
    await expectRowAbsent('reset_tokens', { token: 'forged-reset-rls' })
  })

  it.each(roles)('%s cannot update or delete reset tokens', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(
      await client.from('reset_tokens').update({ used_at: null }).eq('team_id', FIRSTS).select(),
    )
    expectRlsDenied(await client.from('reset_tokens').delete().eq('team_id', FIRSTS).select())
  })

  it('anon cannot insert, update or delete reset tokens', async () => {
    const anon = anonClient()
    expectRlsDenied(
      await anon
        .from('reset_tokens')
        .insert({ user_id: idOf('playerFirsts'), team_id: FIRSTS, token: 'forged-reset-anon' })
        .select(),
    )
    expectRlsDenied(
      await anon.from('reset_tokens').update({ used_at: null }).eq('team_id', FIRSTS).select(),
    )
    expectRlsDenied(await anon.from('reset_tokens').delete().eq('team_id', FIRSTS).select())
    await expectRowAbsent('reset_tokens', { token: 'forged-reset-anon' })
  })
})
