// Epic 19 (Y1) — club_settings. A single row: everyone signed in reads it (a player needs the amount
// and pay link), only an admin writes it. anon reaches nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, signInAs } from './helpers/clients.ts'
import { expectEmpty, expectRlsDenied, expectRows } from './helpers/expect.ts'

// The live settings, captured and restored so this suite doesn't clobber a real amount/link.
let original = { subs_amount: 0 as number, pay_link: null as string | null }

beforeAll(async () => {
  const admin = await signInAs('admin')
  const { data } = await admin
    .from('club_settings')
    .select('subs_amount, pay_link')
    .eq('id', true)
    .single()
  if (data) original = data
})

afterAll(async () => {
  const admin = await signInAs('admin')
  await admin.from('club_settings').update(original).eq('id', true)
})

describe('club_settings (Epic 19)', () => {
  it('every signed-in user reads the single row', async () => {
    const player = await signInAs('playerFirsts')
    const rows = expectRows(
      await player.from('club_settings').select('id, subs_amount, pay_link'),
      1,
    )
    expect(rows[0]?.id).toBe(true)
  })

  it('an admin sets the amount and pay link', async () => {
    const admin = await signInAs('admin')
    const res = await admin
      .from('club_settings')
      .update({ subs_amount: 123.45, pay_link: 'https://pay.example/club' })
      .eq('id', true)
      .select('subs_amount, pay_link')
    expect(res.error).toBeNull()
    expect(res.data?.[0]).toEqual({ subs_amount: 123.45, pay_link: 'https://pay.example/club' })
  })

  it('a non-admin cannot update it (the row is not updatable, zero rows)', async () => {
    const manager = await signInAs('managerFirsts')
    expectEmpty(
      await manager.from('club_settings').update({ subs_amount: 1 }).eq('id', true).select(),
    )
  })

  it('anon holds no grant — read and write are refused', async () => {
    const anon = anonClient()
    expectRlsDenied(await anon.from('club_settings').select('id'))
    expectRlsDenied(await anon.from('club_settings').update({ subs_amount: 1 }).eq('id', true))
  })
})
