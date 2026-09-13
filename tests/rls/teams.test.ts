// Rows 6 and 7, plus the teams cells of rows 38 and 40. Members read their active teams, admins
// read and write everything, nobody deletes (D8, D50).
import { afterAll, describe, expect, it } from 'vitest'

import { deleteTeam, setTeamActive } from './helpers/arrange.ts'
import { anonClient, signInAs } from './helpers/clients.ts'
import { FIRSTS, SECONDS, TEAM_FIRSTS, TEAM_SECONDS } from './helpers/fixtures.ts'
import { expectEmpty, expectRlsDenied, expectRowUnchanged, expectRows } from './helpers/expect.ts'

const created: string[] = []

afterAll(async () => {
  await setTeamActive(FIRSTS, true)
  for (const id of created) await deleteTeam(id)
})

describe('row 6 — teams select', () => {
  it('player selects their own active team and nothing else', async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(await aaron.from('teams').select('id, name, active'), 1)
    expect(rows[0]).toEqual({ id: FIRSTS, name: TEAM_FIRSTS.name, active: true })
  })

  it('player selects nothing for a team they are not in', async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(await aaron.from('teams').select('*', { count: 'exact' }).eq('id', SECONDS))
  })

  it('manager who plays for the other team selects both', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(await declan.from('teams').select('id').order('id'), 2)
    expect(rows.map((r) => r.id)).toEqual([FIRSTS, SECONDS])
  })

  it('player selects nothing for their team once active = false; admin still selects it (D50)', async () => {
    const aaron = await signInAs('playerFirsts')
    const admin = await signInAs('admin')
    await setTeamActive(FIRSTS, false)
    try {
      expectEmpty(await aaron.from('teams').select('*', { count: 'exact' }).eq('id', FIRSTS))
      expectEmpty(await aaron.from('teams').select('*'))
      const rows = expectRows(await admin.from('teams').select('id, active').eq('id', FIRSTS), 1)
      expect(rows[0]).toEqual({ id: FIRSTS, active: false })
    } finally {
      await setTeamActive(FIRSTS, true)
    }
    expectRows(await aaron.from('teams').select('id').eq('id', FIRSTS), 1)
  })

  it('admin selects every team without holding a membership', async () => {
    const admin = await signInAs('admin')
    const rows = expectRows(await admin.from('teams').select('id').order('id'), 2)
    expect(rows.map((r) => r.id)).toEqual([FIRSTS, SECONDS])
  })

  it('stranger selects no team (D37)', async () => {
    const sean = await signInAs('stranger')
    expectEmpty(await sean.from('teams').select('*', { count: 'exact' }))
  })

  it('anon cannot select teams', async () => {
    expectRlsDenied(await anonClient().from('teams').select('*'))
  })
})

describe('row 7 — teams write', () => {
  it('admin inserts a team and renames it', async () => {
    const admin = await signInAs('admin')
    const inserted = expectRows(
      await admin.from('teams').insert({ name: 'RLS Thirds' }).select('id, name, active'),
      1,
    )
    const id = inserted[0]?.id
    if (!id) throw new Error('no id')
    created.push(id)
    expect(inserted[0]).toEqual({ id, name: 'RLS Thirds', active: true })

    const renamed = expectRows(
      await admin.from('teams').update({ name: 'RLS Fourths' }).eq('id', id).select('name'),
      1,
    )
    expect(renamed[0]).toEqual({ name: 'RLS Fourths' })

    const deactivated = expectRows(
      await admin.from('teams').update({ active: false }).eq('id', id).select('active'),
      1,
    )
    expect(deactivated[0]).toEqual({ active: false })
  })

  it('manager insert is refused', async () => {
    const declan = await signInAs('managerFirsts')
    expectRlsDenied(await declan.from('teams').insert({ name: 'RLS Rogue' }).select())
  })

  it('manager update of their own team changes nothing', async () => {
    const declan = await signInAs('managerFirsts')
    expectEmpty(await declan.from('teams').update({ name: 'Renamed' }).eq('id', FIRSTS).select())
    expectEmpty(await declan.from('teams').update({ active: false }).eq('id', FIRSTS).select())
    await expectRowUnchanged('teams', { id: FIRSTS }, { name: TEAM_FIRSTS.name, active: true })
  })

  it('player insert and update are refused or change nothing', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(await aaron.from('teams').insert({ name: 'RLS Rogue' }).select())
    expectEmpty(await aaron.from('teams').update({ name: 'Renamed' }).eq('id', FIRSTS).select())
    await expectRowUnchanged('teams', { id: FIRSTS }, { name: TEAM_FIRSTS.name })
  })

  it('stranger insert is refused and update changes nothing', async () => {
    const sean = await signInAs('stranger')
    expectRlsDenied(await sean.from('teams').insert({ name: 'RLS Rogue' }).select())
    expectEmpty(await sean.from('teams').update({ name: 'Renamed' }).eq('id', SECONDS).select())
    await expectRowUnchanged('teams', { id: SECONDS }, { name: TEAM_SECONDS.name })
  })

  it.each(['playerFirsts', 'managerFirsts', 'admin', 'stranger'] as const)(
    '%s cannot delete a team',
    async (fixture) => {
      const client = await signInAs(fixture)
      expectRlsDenied(await client.from('teams').delete().eq('id', SECONDS).select())
      await expectRowUnchanged('teams', { id: SECONDS }, { name: TEAM_SECONDS.name })
    },
  )

  it('anon cannot insert, update or delete teams', async () => {
    const anon = anonClient()
    expectRlsDenied(await anon.from('teams').insert({ name: 'RLS Rogue' }).select())
    expectRlsDenied(await anon.from('teams').update({ name: 'x' }).eq('id', FIRSTS).select())
    expectRlsDenied(await anon.from('teams').delete().eq('id', FIRSTS).select())
  })
})
