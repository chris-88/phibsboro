// Rows 21–23 and the attendance cells of rows 38 and 40. Players read their own rows and write
// nothing (D32); managers and admins insert, update and delete for their teams' events, always
// as themselves in recorded_by; a leaver's row stays readable to their old manager (D33).
import { afterAll, describe, expect, it } from 'vitest'

import { deleteAttendance } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { EVENT } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectRlsDenied,
  expectRowAbsent,
  expectRowUnchanged,
  expectRows,
} from './helpers/expect.ts'

/** Firsts' past event as the seed leaves it: Declan, six players, the leaver, one absentee = 9. */
const FIRSTS_PAST_ROWS = 9

afterAll(async () => {
  await deleteAttendance(EVENT.firsts.past.id, idOf('playerFirstsAwaiting'))
  await deleteAttendance(EVENT.seconds.past.id, idOf('admin'))
})

describe("row 21 — manager writes attendance for their team's event", () => {
  const ian = { event_id: EVENT.firsts.past.id, user_id: '' }

  it('manager inserts, updates and deletes', async () => {
    const declan = await signInAs('managerFirsts')
    ian.user_id = idOf('playerFirstsAwaiting')
    const inserted = expectRows(
      await declan
        .from('attendance')
        .insert({ ...ian, attended: false, recorded_by: idOf('managerFirsts') })
        .select('attended, recorded_by'),
      1,
    )
    expect(inserted[0]).toEqual({ attended: false, recorded_by: idOf('managerFirsts') })

    const updated = expectRows(
      await declan.from('attendance').update({ attended: true }).match(ian).select('attended'),
      1,
    )
    expect(updated[0]).toEqual({ attended: true })

    expectRows(await declan.from('attendance').delete().match(ian).select(), 1)
    expectEmpty(await declan.from('attendance').select('*').match(ian))
  })

  it('player insert, update and delete are all refused', async () => {
    const aaron = await signInAs('playerFirsts')
    const own = { event_id: EVENT.firsts.past.id, user_id: idOf('playerFirsts') }
    expectRlsDenied(
      await aaron
        .from('attendance')
        .insert({
          event_id: EVENT.firsts.imminent.id,
          user_id: idOf('playerFirsts'),
          attended: true,
          recorded_by: idOf('playerFirsts'),
        })
        .select(),
    )
    await expectRowAbsent('attendance', {
      event_id: EVENT.firsts.imminent.id,
      user_id: idOf('playerFirsts'),
    })
    expectEmpty(await aaron.from('attendance').update({ attended: false }).match(own).select())
    expectEmpty(await aaron.from('attendance').delete().match(own).select())
    await expectRowUnchanged('attendance', own, {
      attended: true,
      recorded_by: idOf('managerFirsts'),
    })
  })

  it('stranger insert is refused and select is empty (D37)', async () => {
    const sean = await signInAs('stranger')
    expectRlsDenied(
      await sean
        .from('attendance')
        .insert({
          event_id: EVENT.firsts.past.id,
          user_id: idOf('stranger'),
          attended: true,
          recorded_by: idOf('stranger'),
        })
        .select(),
    )
    await expectRowAbsent('attendance', { user_id: idOf('stranger') })
    expectEmpty(await sean.from('attendance').select('*', { count: 'exact' }))
  })

  it('anon cannot select, insert, update or delete attendance', async () => {
    const anon = anonClient()
    expectRlsDenied(await anon.from('attendance').select('*'))
    expectRlsDenied(
      await anon
        .from('attendance')
        .insert({ event_id: EVENT.firsts.past.id, user_id: idOf('stranger'), attended: true })
        .select(),
    )
    expectRlsDenied(
      await anon
        .from('attendance')
        .update({ attended: false })
        .eq('event_id', EVENT.firsts.past.id)
        .select(),
    )
    expectRlsDenied(
      await anon.from('attendance').delete().eq('event_id', EVENT.firsts.past.id).select(),
    )
  })
})

describe('row 22 — recorded_by and team scope', () => {
  it('manager insert with recorded_by set to another user is refused', async () => {
    const declan = await signInAs('managerFirsts')
    expectRlsDenied(
      await declan
        .from('attendance')
        .insert({
          event_id: EVENT.firsts.past.id,
          user_id: idOf('playerFirstsAwaiting'),
          attended: true,
          recorded_by: idOf('playerFirsts'),
        })
        .select(),
    )
    await expectRowAbsent('attendance', {
      event_id: EVENT.firsts.past.id,
      user_id: idOf('playerFirstsAwaiting'),
    })
  })

  it('manager update that re-attributes recorded_by is refused', async () => {
    const declan = await signInAs('managerFirsts')
    const own = { event_id: EVENT.firsts.past.id, user_id: idOf('playerFirsts') }
    expectRlsDenied(
      await declan
        .from('attendance')
        .update({ recorded_by: idOf('playerFirsts') })
        .match(own)
        .select(),
    )
    await expectRowUnchanged('attendance', own, { recorded_by: idOf('managerFirsts') })
  })

  it('manager insert against an event on a team they merely play for is refused', async () => {
    const declan = await signInAs('managerFirsts')
    expectRlsDenied(
      await declan
        .from('attendance')
        .insert({
          event_id: EVENT.seconds.past.id,
          user_id: idOf('managerFirsts'),
          attended: true,
          recorded_by: idOf('managerFirsts'),
        })
        .select(),
    )
    await expectRowAbsent('attendance', {
      event_id: EVENT.seconds.past.id,
      user_id: idOf('managerFirsts'),
    })
  })

  it("manager update and delete against the other team's rows affect nothing", async () => {
    const declan = await signInAs('managerFirsts')
    const niamh = await signInAs('managerSeconds')
    const seconds = { event_id: EVENT.seconds.past.id, user_id: idOf('playerSeconds') }
    const firsts = { event_id: EVENT.firsts.past.id, user_id: idOf('playerFirsts') }
    expectEmpty(await declan.from('attendance').update({ attended: false }).match(seconds).select())
    expectEmpty(await declan.from('attendance').delete().match(seconds).select())
    expectEmpty(await niamh.from('attendance').update({ attended: false }).match(firsts).select())
    expectEmpty(await niamh.from('attendance').delete().match(firsts).select())
    await expectRowUnchanged('attendance', seconds, {
      attended: true,
      recorded_by: idOf('managerSeconds'),
    })
    await expectRowUnchanged('attendance', firsts, {
      attended: true,
      recorded_by: idOf('managerFirsts'),
    })
  })

  it('manager of Seconds inserting against a Firsts event is refused', async () => {
    const niamh = await signInAs('managerSeconds')
    expectRlsDenied(
      await niamh
        .from('attendance')
        .insert({
          event_id: EVENT.firsts.past.id,
          user_id: idOf('playerFirstsAwaiting'),
          attended: true,
          recorded_by: idOf('managerSeconds'),
        })
        .select(),
    )
    await expectRowAbsent('attendance', {
      event_id: EVENT.firsts.past.id,
      user_id: idOf('playerFirstsAwaiting'),
    })
  })
})

describe('row 23 — who reads which attendance', () => {
  it('player selects own rows only', async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(await aaron.from('attendance').select('event_id, user_id, attended'), 1)
    expect(rows[0]).toEqual({
      event_id: EVENT.firsts.past.id,
      user_id: idOf('playerFirsts'),
      attended: true,
    })
  })

  it("player selects nothing of a teammate's (D32)", async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(
      await aaron
        .from('attendance')
        .select('*', { count: 'exact' })
        .eq('user_id', idOf('playerFirstsOther')),
    )
  })

  it("manager selects every row for their team's event, the leaver's included (D33)", async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(
      await declan
        .from('attendance')
        .select('user_id, attended')
        .eq('event_id', EVENT.firsts.past.id),
      FIRSTS_PAST_ROWS,
    )
    expect(rows.find((r) => r.user_id === idOf('leaver'))).toEqual({
      user_id: idOf('leaver'),
      attended: true,
    })
    expect(rows.filter((r) => !r.attended)).toHaveLength(1)
  })

  it('the leaver still selects their own attendance row', async () => {
    const mark = await signInAs('leaver')
    const rows = expectRows(await mark.from('attendance').select('event_id, attended'), 1)
    expect(rows[0]).toEqual({ event_id: EVENT.firsts.past.id, attended: true })
  })

  it("manager selects nothing for the other team's event", async () => {
    const niamh = await signInAs('managerSeconds')
    expectEmpty(
      await niamh
        .from('attendance')
        .select('*', { count: 'exact' })
        .eq('event_id', EVENT.firsts.past.id),
    )
  })

  it("manager who plays for the other team does not read a teammate's row there; that team's manager does", async () => {
    const declan = await signInAs('managerFirsts')
    const niamh = await signInAs('managerSeconds')
    const liam = { event_id: EVENT.seconds.past.id, user_id: idOf('playerSeconds') }
    expectRows(await niamh.from('attendance').select('user_id').match(liam), 1)
    expectEmpty(await declan.from('attendance').select('*').match(liam))
  })
})

describe('row 40 — admin on a team they are not a member of', () => {
  it('admin selects every row, and inserts, updates and deletes as themselves', async () => {
    const admin = await signInAs('admin')
    expectRows(await admin.from('attendance').select('event_id'), 17)
    const row = { event_id: EVENT.seconds.past.id, user_id: idOf('admin') }
    expectRows(
      await admin
        .from('attendance')
        .insert({ ...row, attended: true, recorded_by: idOf('admin') })
        .select(),
      1,
    )
    const updated = expectRows(
      await admin.from('attendance').update({ attended: false }).match(row).select('attended'),
      1,
    )
    expect(updated[0]).toEqual({ attended: false })
    expectRows(await admin.from('attendance').delete().match(row).select(), 1)
  })

  it('admin insert with recorded_by set to someone else is refused too', async () => {
    const admin = await signInAs('admin')
    expectRlsDenied(
      await admin
        .from('attendance')
        .insert({
          event_id: EVENT.seconds.past.id,
          user_id: idOf('admin'),
          attended: true,
          recorded_by: idOf('managerSeconds'),
        })
        .select(),
    )
    await expectRowAbsent('attendance', { event_id: EVENT.seconds.past.id, user_id: idOf('admin') })
  })
})
