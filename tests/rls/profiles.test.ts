// Rows 4, 5 and the profiles cells of rows 38 and 40. One read policy, own row only, for every
// role including admin (D8); no write path of any kind.
import { describe, expect, it } from 'vitest'

import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { FIXTURES } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectNoExecute,
  expectRlsDenied,
  expectRowUnchanged,
  expectRows,
} from './helpers/expect.ts'

describe('row 4 — profiles select is own row only', () => {
  it('player selects their own row, and an unfiltered select returns exactly one row', async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(await aaron.from('profiles').select('*'), 1)
    expect(rows[0]).toMatchObject({
      id: idOf('playerFirsts'),
      name: FIXTURES.playerFirsts.name,
      phone: FIXTURES.playerFirsts.phone,
      is_admin: false,
    })
    const { count } = await aaron.from('profiles').select('*', { count: 'exact', head: true })
    expect(count).toBe(1)
  })

  it("player selects nothing by a teammate's id", async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(
      await aaron
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('id', idOf('playerFirstsOther')),
    )
  })

  it('manager selects only their own row, not their players', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(await declan.from('profiles').select('id'), 1)
    expect(rows[0]?.id).toBe(idOf('managerFirsts'))
  })

  it('admin also gets exactly one row, their own (D8)', async () => {
    const admin = await signInAs('admin')
    const rows = expectRows(await admin.from('profiles').select('id, is_admin'), 1)
    expect(rows[0]).toEqual({ id: idOf('admin'), is_admin: true })
    expectEmpty(await admin.from('profiles').select('*').eq('id', idOf('playerFirsts')))
  })

  it('stranger gets exactly their own row and nothing by another id (D37)', async () => {
    const sean = await signInAs('stranger')
    const rows = expectRows(await sean.from('profiles').select('id'), 1)
    expect(rows[0]?.id).toBe(idOf('stranger'))
    expectEmpty(await sean.from('profiles').select('*').eq('id', idOf('playerFirsts')))
  })

  it('anon cannot select profiles at all', async () => {
    expectRlsDenied(await anonClient().from('profiles').select('*'))
  })
})

describe('row 5 — nobody can write profiles through the anon key', () => {
  const fixtures = ['playerFirsts', 'managerFirsts', 'admin', 'stranger'] as const

  it.each(fixtures)('%s cannot update name on their own row', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(
      await client.from('profiles').update({ name: 'Renamed' }).eq('id', idOf(fixture)).select(),
    )
    await expectRowUnchanged('profiles', { id: idOf(fixture) }, { name: FIXTURES[fixture].name })
  })

  it.each(fixtures)('%s cannot update phone on their own row', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(
      await client
        .from('profiles')
        .update({ phone: '+353899997799' })
        .eq('id', idOf(fixture))
        .select(),
    )
    await expectRowUnchanged('profiles', { id: idOf(fixture) }, { phone: FIXTURES[fixture].phone })
  })

  it.each(fixtures)('%s cannot set is_admin on any row', async (fixture) => {
    const client = await signInAs(fixture)
    // Not a write the client tree may contain (S1.2 AC12); here it is the attack being refused.
    const flag = { is_admin: fixture !== 'admin' }
    expectRlsDenied(await client.from('profiles').update(flag).eq('id', idOf(fixture)).select())
    expectRlsDenied(
      await client.from('profiles').update(flag).eq('id', idOf('playerFirstsOther')).select(),
    )
    await expectRowUnchanged('profiles', { id: idOf(fixture) }, { is_admin: fixture === 'admin' })
    await expectRowUnchanged('profiles', { id: idOf('playerFirstsOther') }, { is_admin: false })
  })

  it.each(fixtures)('%s cannot insert a profile', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(
      await client
        .from('profiles')
        .insert({
          id: '00000000-0000-4000-8000-00000000beef',
          name: 'Ghost',
          phone: '+353899997798',
        })
        .select(),
    )
  })

  it.each(fixtures)('%s cannot delete a profile, their own included', async (fixture) => {
    const client = await signInAs(fixture)
    expectRlsDenied(await client.from('profiles').delete().eq('id', idOf(fixture)).select())
    await expectRowUnchanged('profiles', { id: idOf(fixture) }, { phone: FIXTURES[fixture].phone })
  })

  it('anon cannot insert or update profiles', async () => {
    const anon = anonClient()
    expectRlsDenied(
      await anon
        .from('profiles')
        .insert({
          id: '00000000-0000-4000-8000-00000000beef',
          name: 'Ghost',
          phone: '+353899997798',
        })
        .select(),
    )
    expectRlsDenied(
      await anon.from('profiles').update({ name: 'x' }).eq('id', idOf('admin')).select(),
    )
  })
})

describe('touch_last_seen (S18.6)', () => {
  it('a signed-in user stamps their own last_seen_at', async () => {
    const aaron = await signInAs('playerFirsts')
    expect((await aaron.rpc('touch_last_seen')).error).toBeNull()
    const rows = expectRows(await aaron.from('profiles').select('last_seen_at'), 1)
    expect(rows[0]?.last_seen_at).not.toBeNull()
  })

  it('anon holds no execute', async () => {
    expectNoExecute(await anonClient().rpc('touch_last_seen'))
  })
})
