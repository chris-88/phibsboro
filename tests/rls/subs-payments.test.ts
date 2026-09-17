// Epic 19 (Y2) — subs_payments. Admins write; a payer reads their own, a manager reads the rows of
// members on a team they manage, a teammate who is not a manager reads none. anon reaches nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { expectEmpty, expectRlsDenied, expectRows } from './helpers/expect.ts'

// A payment the admin records for Aaron (a Firsts player); removed in afterAll so it doesn't linger.
let paymentId = ''

beforeAll(async () => {
  const admin = await signInAs('admin')
  const res = await admin
    .from('subs_payments')
    .insert({ user_id: idOf('playerFirsts'), amount: 25, recorded_by: idOf('admin') })
    .select('id')
  expect(res.error).toBeNull()
  paymentId = res.data?.[0]?.id ?? ''
})

afterAll(async () => {
  if (paymentId) {
    const admin = await signInAs('admin')
    await admin.from('subs_payments').delete().eq('id', paymentId)
  }
})

describe('subs_payments (Epic 19)', () => {
  it('the payer reads their own payment', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRows(
      await aaron.from('subs_payments').select('amount').eq('user_id', idOf('playerFirsts')),
      1,
    )
  })

  it('a manager of the payer’s team reads it', async () => {
    const declan = await signInAs('managerFirsts')
    expectRows(
      await declan.from('subs_payments').select('amount').eq('user_id', idOf('playerFirsts')),
      1,
    )
  })

  it('a teammate who is not a manager reads none of it', async () => {
    const ben = await signInAs('playerFirstsOther')
    expectEmpty(
      await ben.from('subs_payments').select('amount').eq('user_id', idOf('playerFirsts')),
    )
  })

  it('a non-admin cannot record a payment (with-check refuses, 42501)', async () => {
    const declan = await signInAs('managerFirsts')
    expectRlsDenied(
      await declan
        .from('subs_payments')
        .insert({ user_id: idOf('playerFirsts'), amount: 10 })
        .select(),
    )
  })

  it('anon reaches nothing', async () => {
    const anon = anonClient()
    expectRlsDenied(await anon.from('subs_payments').select('id'))
  })
})
