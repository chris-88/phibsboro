// Rows 9–13 and the events cells of rows 38 and 40. Members read their teams' events, a leaver
// keeps the ones they hold a row for (D33), managers write within their teams while the team is
// active (D50), only admins delete (D31).
import { afterAll, describe, expect, it } from 'vitest'

import {
  deleteEvent,
  insertAttendance,
  insertEvent,
  insertResponse,
  setTeamActive,
} from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { EVENT, FIRSTS, SECONDS, UNKNOWN_UUID } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectRlsDenied,
  expectRowAbsent,
  expectRowUnchanged,
  expectRows,
} from './helpers/expect.ts'

const inTenDays = () => new Date(Date.now() + 10 * 86_400_000).toISOString()

/** A Firsts event this file owns, so the seeded rows are never edited. */
const OWNED = '00000000-0000-4000-8000-0000000000e1'
/** The event row 13 destroys, with a response and an attendance row hanging off it. */
const DOOMED = '00000000-0000-4000-8000-0000000000e2'

const created = new Set<string>([OWNED, DOOMED])

afterAll(async () => {
  await setTeamActive(SECONDS, true)
  for (const id of created) await deleteEvent(id)
})

describe('row 9 — events select', () => {
  it("player selects their team's four events and nothing else", async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(await aaron.from('events').select('id, team_id'), 4)
    expect(rows.every((r) => r.team_id === FIRSTS)).toBe(true)
    expect(rows.map((r) => r.id).sort()).toEqual(
      Object.values(EVENT.firsts)
        .map((e) => e.id)
        .sort(),
    )
  })

  it("player filtering on another team's id gets [] and no error", async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(await aaron.from('events').select('*', { count: 'exact' }).eq('team_id', SECONDS))
  })

  it("player selecting another team's event by id gets [] and no error", async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(await aaron.from('events').select('*').eq('id', EVENT.seconds.imminent.id))
  })

  it('manager of Seconds selects no Firsts event', async () => {
    const niamh = await signInAs('managerSeconds')
    expectEmpty(await niamh.from('events').select('*', { count: 'exact' }).eq('team_id', FIRSTS))
    expectRows(await niamh.from('events').select('id').eq('team_id', SECONDS), 4)
  })

  it('stranger selects no event (D37)', async () => {
    const sean = await signInAs('stranger')
    expectEmpty(await sean.from('events').select('*', { count: 'exact' }))
    expectEmpty(await sean.from('events').select('*').eq('id', EVENT.firsts.imminent.id))
  })

  it('anon cannot select events', async () => {
    expectRlsDenied(await anonClient().from('events').select('*'))
  })
})

describe('row 10 — a leaver keeps the events they hold a row for (D33)', () => {
  it('leaver selects the event they responded to and the one they attended, and no other', async () => {
    const mark = await signInAs('leaver')
    const rows = expectRows(await mark.from('events').select('id'), 2)
    expect(rows.map((r) => r.id).sort()).toEqual(
      [EVENT.firsts.imminent.id, EVENT.firsts.past.id].sort(),
    )
    expectEmpty(await mark.from('events').select('*').eq('id', EVENT.firsts.far.id))
    expectEmpty(await mark.from('events').select('*').eq('id', EVENT.firsts.cancelled.id))
  })
})

describe('row 11 — events insert', () => {
  it('manager inserts on a team they manage', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(
      await declan
        .from('events')
        .insert({
          id: OWNED,
          team_id: FIRSTS,
          type: 'match',
          title: 'RLS owned match',
          location: 'Dalymount Park',
          starts_at: inTenDays(),
          created_by: idOf('managerFirsts'),
        })
        .select('id, team_id, status'),
      1,
    )
    expect(rows[0]).toEqual({ id: OWNED, team_id: FIRSTS, status: 'scheduled' })
  })

  it('manager insert on another team is refused, even one they play for', async () => {
    const declan = await signInAs('managerFirsts')
    expectRlsDenied(
      await declan
        .from('events')
        .insert({
          team_id: SECONDS,
          type: 'training',
          title: 'RLS rogue',
          location: 'Nowhere',
          starts_at: inTenDays(),
        })
        .select(),
    )
    await expectRowAbsent('events', { title: 'RLS rogue' })
  })

  it('manager insert on an inactive team is refused; so is admin insert (D50)', async () => {
    const niamh = await signInAs('managerSeconds')
    const admin = await signInAs('admin')
    await setTeamActive(SECONDS, false)
    try {
      expectRlsDenied(
        await niamh
          .from('events')
          .insert({
            team_id: SECONDS,
            type: 'training',
            title: 'RLS inactive',
            location: 'Nowhere',
            starts_at: inTenDays(),
          })
          .select(),
      )
      expectRlsDenied(
        await admin
          .from('events')
          .insert({
            team_id: SECONDS,
            type: 'training',
            title: 'RLS inactive',
            location: 'Nowhere',
            starts_at: inTenDays(),
          })
          .select(),
      )
    } finally {
      await setTeamActive(SECONDS, true)
    }
    await expectRowAbsent('events', { title: 'RLS inactive' })
  })

  it('player insert is refused', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('events')
        .insert({
          team_id: FIRSTS,
          type: 'training',
          title: 'RLS player',
          location: 'Nowhere',
          starts_at: inTenDays(),
        })
        .select(),
    )
    await expectRowAbsent('events', { title: 'RLS player' })
  })

  it('stranger insert is refused (D37)', async () => {
    const sean = await signInAs('stranger')
    expectRlsDenied(
      await sean
        .from('events')
        .insert({
          team_id: FIRSTS,
          type: 'training',
          title: 'RLS stranger',
          location: 'Nowhere',
          starts_at: inTenDays(),
        })
        .select(),
    )
    await expectRowAbsent('events', { title: 'RLS stranger' })
  })

  it('anon insert is refused', async () => {
    expectRlsDenied(
      await anonClient()
        .from('events')
        .insert({
          team_id: FIRSTS,
          type: 'training',
          title: 'RLS anon',
          location: 'Nowhere',
          starts_at: inTenDays(),
        })
        .select(),
    )
  })
})

describe('row 12 — events update', () => {
  it('manager updates title and cancels their own event', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(
      await declan
        .from('events')
        .update({ title: 'RLS owned match, renamed', status: 'cancelled' })
        .eq('id', OWNED)
        .select('title, status'),
      1,
    )
    expect(rows[0]).toEqual({ title: 'RLS owned match, renamed', status: 'cancelled' })
  })

  it("manager update on another team's event changes nothing", async () => {
    const niamh = await signInAs('managerSeconds')
    expectEmpty(
      await niamh
        .from('events')
        .update({ title: 'Hijacked', status: 'cancelled' })
        .eq('id', EVENT.firsts.far.id)
        .select(),
    )
    await expectRowUnchanged(
      'events',
      { id: EVENT.firsts.far.id },
      { title: EVENT.firsts.far.title, status: 'scheduled' },
    )
  })

  it('manager update on a team they merely play for changes nothing', async () => {
    const declan = await signInAs('managerFirsts')
    expectEmpty(
      await declan
        .from('events')
        .update({ title: 'Hijacked' })
        .eq('id', EVENT.seconds.far.id)
        .select(),
    )
    await expectRowUnchanged(
      'events',
      { id: EVENT.seconds.far.id },
      { title: EVENT.seconds.far.title },
    )
  })

  it("player update on their own team's event changes nothing", async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(
      await aaron
        .from('events')
        .update({ title: 'Hijacked' })
        .eq('id', EVENT.firsts.far.id)
        .select(),
    )
    await expectRowUnchanged(
      'events',
      { id: EVENT.firsts.far.id },
      { title: EVENT.firsts.far.title },
    )
  })

  it('manager cannot move their event to a team they do not manage', async () => {
    const declan = await signInAs('managerFirsts')
    expectRlsDenied(
      await declan.from('events').update({ team_id: SECONDS }).eq('id', OWNED).select(),
    )
    await expectRowUnchanged('events', { id: OWNED }, { team_id: FIRSTS })
  })

  it('anon update is refused', async () => {
    expectRlsDenied(
      await anonClient()
        .from('events')
        .update({ title: 'x' })
        .eq('id', EVENT.firsts.far.id)
        .select(),
    )
  })
})

describe('row 13 — events delete', () => {
  it('manager delete affects zero rows and the row is still there (D31)', async () => {
    const declan = await signInAs('managerFirsts')
    expectEmpty(await declan.from('events').delete().eq('id', OWNED).select())
    await expectRowUnchanged('events', { id: OWNED }, { team_id: FIRSTS })
  })

  it('player and stranger delete affect zero rows', async () => {
    const aaron = await signInAs('playerFirsts')
    const sean = await signInAs('stranger')
    expectEmpty(await aaron.from('events').delete().eq('id', EVENT.firsts.far.id).select())
    expectEmpty(await sean.from('events').delete().eq('id', EVENT.firsts.far.id).select())
    await expectRowUnchanged(
      'events',
      { id: EVENT.firsts.far.id },
      { title: EVENT.firsts.far.title },
    )
  })

  it('anon delete is refused', async () => {
    expectRlsDenied(
      await anonClient().from('events').delete().eq('id', EVENT.firsts.far.id).select(),
    )
  })

  it("admin deletes, and the event's responses and attendance vanish with it", async () => {
    await insertEvent({
      id: DOOMED,
      team_id: SECONDS,
      type: 'training',
      title: 'RLS doomed',
      location: 'Nowhere',
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
    })
    await insertResponse({
      event_id: DOOMED,
      user_id: idOf('playerSeconds'),
      response: 'available',
    })
    await insertAttendance({
      event_id: DOOMED,
      user_id: idOf('playerSeconds'),
      attended: true,
      recorded_by: idOf('managerSeconds'),
    })

    const admin = await signInAs('admin')
    // Admin reads everything, so the arrange is visible as a role before it is destroyed.
    expectRows(await admin.from('event_responses').select('*').eq('event_id', DOOMED), 1)
    expectRows(await admin.from('attendance').select('*').eq('event_id', DOOMED), 1)

    const rows = expectRows(await admin.from('events').delete().eq('id', DOOMED).select('id'), 1)
    expect(rows[0]).toEqual({ id: DOOMED })
    created.delete(DOOMED)

    expectEmpty(await admin.from('events').select('*').eq('id', DOOMED))
    expectEmpty(await admin.from('event_responses').select('*').eq('event_id', DOOMED))
    expectEmpty(await admin.from('attendance').select('*').eq('event_id', DOOMED))
  })
})

describe('row 40 — admin on a team they are not a member of', () => {
  it('admin selects, inserts and updates events on Seconds', async () => {
    const admin = await signInAs('admin')
    expectRows(await admin.from('events').select('id'), 8 + 1) // eight seeded plus OWNED
    const id = '00000000-0000-4000-8000-0000000000e3'
    created.add(id)
    const inserted = expectRows(
      await admin
        .from('events')
        .insert({
          id,
          team_id: SECONDS,
          type: 'training',
          title: 'RLS admin',
          location: 'Nowhere',
          starts_at: inTenDays(),
        })
        .select('id'),
      1,
    )
    expect(inserted[0]).toEqual({ id })
    const updated = expectRows(
      await admin.from('events').update({ location: 'Somewhere' }).eq('id', id).select('location'),
      1,
    )
    expect(updated[0]).toEqual({ location: 'Somewhere' })
    expectRows(await admin.from('events').delete().eq('id', id).select('id'), 1)
    created.delete(id)
  })

  it('unknown id is [] for everyone signed in, not an error', async () => {
    for (const fixture of ['playerFirsts', 'managerFirsts', 'admin', 'stranger'] as const) {
      const client = await signInAs(fixture)
      expectEmpty(await client.from('events').select('*').eq('id', UNKNOWN_UUID))
    }
  })
})
