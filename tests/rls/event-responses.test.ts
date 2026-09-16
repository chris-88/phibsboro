// Rows 14–20 and the event_responses cells of rows 38 and 40. A player writes their own row while
// the event is scheduled and unstarted (D12), reads only their own rows (D32); a manager reads
// every row for their teams' events including a leaver's (D33); nobody but an admin deletes (D61).
import { afterAll, describe, expect, it } from 'vitest'

import { deleteResponse, setResponse } from './helpers/arrange.ts'
import { anonClient, idOf, signInAs } from './helpers/clients.ts'
import { EVENT } from './helpers/fixtures.ts'
import {
  expectEmpty,
  expectRlsDenied,
  expectRowAbsent,
  expectRowUnchanged,
  expectRows,
} from './helpers/expect.ts'

/** Firsts' imminent event as the seed leaves it: 6 available, 3 unavailable, the leaver = 10 rows. */
const FIRSTS_IMMINENT_ROWS = 10

afterAll(async () => {
  // Ian's rows from row 14 and the S3.4 case, and Aaron's far-event row back to the seeded value.
  await deleteResponse(EVENT.firsts.imminent.id, idOf('playerFirstsAwaiting'))
  await deleteResponse(EVENT.firsts.far.id, idOf('playerFirstsAwaiting'))
  await setResponse(EVENT.firsts.far.id, idOf('playerFirsts'), 'available')
})

describe('row 14 — player inserts their own response', () => {
  it('player inserts own row for a scheduled future event', async () => {
    const ian = await signInAs('playerFirstsAwaiting')
    const rows = expectRows(
      await ian
        .from('event_responses')
        .insert({
          event_id: EVENT.firsts.imminent.id,
          user_id: idOf('playerFirstsAwaiting'),
          response: 'available',
        })
        .select('event_id, user_id, response'),
      1,
    )
    expect(rows[0]).toEqual({
      event_id: EVENT.firsts.imminent.id,
      user_id: idOf('playerFirstsAwaiting'),
      response: 'available',
    })
  })

  it("insert carrying another user's user_id is refused (D12)", async () => {
    const ian = await signInAs('playerFirstsAwaiting')
    expectRlsDenied(
      await ian
        .from('event_responses')
        .insert({
          event_id: EVENT.firsts.imminent.id,
          user_id: idOf('playerFirstsAwaitingOther'),
          response: 'available',
        })
        .select(),
    )
    await expectRowAbsent('event_responses', {
      event_id: EVENT.firsts.imminent.id,
      user_id: idOf('playerFirstsAwaitingOther'),
    })
  })

  it("insert for another team's event is refused, own user_id or not", async () => {
    const ian = await signInAs('playerFirstsAwaiting')
    expectRlsDenied(
      await ian
        .from('event_responses')
        .insert({
          event_id: EVENT.seconds.imminent.id,
          user_id: idOf('playerFirstsAwaiting'),
          response: 'available',
        })
        .select(),
    )
    await expectRowAbsent('event_responses', {
      event_id: EVENT.seconds.imminent.id,
      user_id: idOf('playerFirstsAwaiting'),
    })
  })

  it('upsert of own row, the shape the YES / NO buttons send, works', async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(
      await aaron
        .from('event_responses')
        .upsert(
          { event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts'), response: 'available' },
          { onConflict: 'event_id,user_id' },
        )
        .select('response'),
      1,
    )
    expect(rows[0]).toEqual({ response: 'available' })
  })
})

describe('row 15 — player updates their own response', () => {
  it('player updates own row available → unavailable', async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(
      await aaron
        .from('event_responses')
        .update({ response: 'unavailable', reason: 'Away this weekend' })
        .match({ event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts') })
        .select('response'),
      1,
    )
    expect(rows[0]).toEqual({ response: 'unavailable' })
  })

  it("update of a teammate's row changes nothing (D32)", async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(
      await aaron
        .from('event_responses')
        .update({ response: 'unavailable', reason: 'Away this weekend' })
        .match({ event_id: EVENT.firsts.far.id, user_id: idOf('playerFirstsOther') })
        .select(),
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.far.id, user_id: idOf('playerFirstsOther') },
      { response: 'available' },
    )
  })

  it('player cannot re-key their own row onto another user', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('event_responses')
        .update({ user_id: idOf('playerFirstsAwaitingOther') })
        .match({ event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts') },
      { response: 'unavailable' },
    )
  })
})

describe('S3.4 AC1 — a genuine change on a scheduled future event', () => {
  it('upsert available then unavailable both succeed, one row, updated_at advances', async () => {
    const ian = await signInAs('playerFirstsAwaiting')
    const key = { event_id: EVENT.firsts.far.id, user_id: idOf('playerFirstsAwaiting') }

    const first = expectRows(
      await ian
        .from('event_responses')
        .upsert({ ...key, response: 'available' }, { onConflict: 'event_id,user_id' })
        .select('response, updated_at'),
      1,
    )
    expect(first[0]?.response).toBe('available')

    const second = expectRows(
      await ian
        .from('event_responses')
        .upsert(
          { ...key, response: 'unavailable', reason: 'Away this weekend' },
          { onConflict: 'event_id,user_id' },
        )
        .select('response, updated_at'),
      1,
    )
    expect(second[0]?.response).toBe('unavailable')

    // The before-update trigger, not the client, advances updated_at (the client sends none).
    const firstAt = first[0]?.updated_at ?? ''
    const secondAt = second[0]?.updated_at ?? ''
    expect(Date.parse(secondAt)).toBeGreaterThan(Date.parse(firstAt))

    // Exactly one row for the pair throughout — an upsert changed the value, it did not add a row.
    expectRows(await ian.from('event_responses').select('user_id').match(key), 1)

    // Ian holds no seeded row anywhere, so remove this one now rather than only in afterAll, or it
    // inflates the file-wide response count the row 40 admin test asserts.
    await deleteResponse(EVENT.firsts.far.id, idOf('playerFirstsAwaiting'))
  })
})

describe('row 16 — the starts_at cut-off (D12)', () => {
  it('insert for an event whose starts_at has passed is refused', async () => {
    const ian = await signInAs('playerFirstsAwaiting')
    expectRlsDenied(
      await ian
        .from('event_responses')
        .insert({
          event_id: EVENT.firsts.past.id,
          user_id: idOf('playerFirstsAwaiting'),
          response: 'available',
        })
        .select(),
    )
    await expectRowAbsent('event_responses', {
      event_id: EVENT.firsts.past.id,
      user_id: idOf('playerFirstsAwaiting'),
    })
  })

  it('update of own row for a past event is refused', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('event_responses')
        .update({ response: 'unavailable', reason: 'Away this weekend' })
        .match({ event_id: EVENT.firsts.past.id, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.past.id, user_id: idOf('playerFirsts') },
      { response: 'available' },
    )
  })
})

describe('row 17 — cancelled events take no response (D12)', () => {
  it('insert for a cancelled event is refused', async () => {
    const ian = await signInAs('playerFirstsAwaiting')
    expectRlsDenied(
      await ian
        .from('event_responses')
        .insert({
          event_id: EVENT.firsts.cancelled.id,
          user_id: idOf('playerFirstsAwaiting'),
          response: 'available',
        })
        .select(),
    )
    await expectRowAbsent('event_responses', {
      event_id: EVENT.firsts.cancelled.id,
      user_id: idOf('playerFirstsAwaiting'),
    })
  })

  it('update of own row for a cancelled event is refused', async () => {
    const aaron = await signInAs('playerFirsts')
    expectRlsDenied(
      await aaron
        .from('event_responses')
        .update({ response: 'unavailable', reason: 'Away this weekend' })
        .match({ event_id: EVENT.firsts.cancelled.id, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.cancelled.id, user_id: idOf('playerFirsts') },
      { response: 'available' },
    )
  })
})

describe('row 18 — no player or manager delete (D61)', () => {
  it('player delete of their own row affects zero rows', async () => {
    const aaron = await signInAs('playerFirsts')
    expectEmpty(
      await aaron
        .from('event_responses')
        .delete()
        .match({ event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts') },
      { response: 'unavailable' },
    )
  })

  it("manager delete of a player's row affects zero rows", async () => {
    const declan = await signInAs('managerFirsts')
    expectEmpty(
      await declan
        .from('event_responses')
        .delete()
        .match({ event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts') })
        .select(),
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.far.id, user_id: idOf('playerFirsts') },
      { response: 'unavailable' },
    )
  })

  it('anon delete is refused', async () => {
    expectRlsDenied(
      await anonClient()
        .from('event_responses')
        .delete()
        .eq('event_id', EVENT.firsts.far.id)
        .select(),
    )
  })
})

describe('row 19 — who reads which responses', () => {
  it("manager selects every row for their team's event", async () => {
    const declan = await signInAs('managerFirsts')
    // The seeded ten plus Ian's row from row 14.
    const rows = expectRows(
      await declan
        .from('event_responses')
        .select('user_id')
        .eq('event_id', EVENT.firsts.imminent.id),
      FIRSTS_IMMINENT_ROWS + 1,
    )
    expect(rows.some((r) => r.user_id === idOf('playerFirstsOther'))).toBe(true)
  })

  it("manager selects nothing for another team's event", async () => {
    const niamh = await signInAs('managerSeconds')
    expectEmpty(
      await niamh
        .from('event_responses')
        .select('*', { count: 'exact' })
        .eq('event_id', EVENT.firsts.imminent.id),
    )
  })

  it('manager who plays for the other team reads only their own row there', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(
      await declan
        .from('event_responses')
        .select('user_id')
        .eq('event_id', EVENT.seconds.imminent.id),
      1,
    )
    expect(rows[0]).toEqual({ user_id: idOf('managerFirsts') })
  })

  it('player selects only their own row for an event with many', async () => {
    const aaron = await signInAs('playerFirsts')
    const rows = expectRows(
      await aaron
        .from('event_responses')
        .select('user_id')
        .eq('event_id', EVENT.firsts.imminent.id),
      1,
    )
    expect(rows[0]).toEqual({ user_id: idOf('playerFirsts') })
    expectEmpty(
      await aaron.from('event_responses').select('*').eq('user_id', idOf('playerFirstsOther')),
    )
  })

  it('stranger selects nothing (D37)', async () => {
    const sean = await signInAs('stranger')
    expectEmpty(await sean.from('event_responses').select('*', { count: 'exact' }))
  })

  it('anon cannot select event_responses', async () => {
    expectRlsDenied(await anonClient().from('event_responses').select('*'))
  })
})

describe("row 20 — a leaver's rows stay readable to them and their old manager (D33)", () => {
  it('manager still selects the row of a user removed from the squad', async () => {
    const declan = await signInAs('managerFirsts')
    const rows = expectRows(
      await declan
        .from('event_responses')
        .select('response')
        .match({ event_id: EVENT.firsts.imminent.id, user_id: idOf('leaver') }),
      1,
    )
    expect(rows[0]).toEqual({ response: 'available' })
  })

  it('the removed user still selects their own row and the event it belongs to', async () => {
    const mark = await signInAs('leaver')
    const rows = expectRows(await mark.from('event_responses').select('event_id, response'), 1)
    expect(rows[0]).toEqual({ event_id: EVENT.firsts.imminent.id, response: 'available' })
    expectRows(await mark.from('events').select('id').eq('id', EVENT.firsts.imminent.id), 1)
  })

  it('the removed user cannot change that row once out of the squad', async () => {
    const mark = await signInAs('leaver')
    expectRlsDenied(
      await mark
        .from('event_responses')
        .update({ response: 'unavailable', reason: 'Away this weekend' })
        .match({ event_id: EVENT.firsts.imminent.id, user_id: idOf('leaver') })
        .select(),
    )
    await expectRowUnchanged(
      'event_responses',
      { event_id: EVENT.firsts.imminent.id, user_id: idOf('leaver') },
      { response: 'available' },
    )
  })

  it('a manager of the other team still selects nothing for that event, removed member or not', async () => {
    const niamh = await signInAs('managerSeconds')
    expectEmpty(
      await niamh
        .from('event_responses')
        .select('*')
        .match({ event_id: EVENT.firsts.imminent.id, user_id: idOf('leaver') }),
    )
  })
})

describe('row 40 — admin on a team they are not a member of', () => {
  const row = { event_id: EVENT.seconds.far.id, user_id: '' }

  it('admin selects every response, and inserts, updates and deletes one of their own', async () => {
    const admin = await signInAs('admin')
    row.user_id = idOf('admin')
    const all = expectRows(await admin.from('event_responses').select('event_id'), 44 + 1)
    expect(all.filter((r) => r.event_id === EVENT.seconds.imminent.id)).toHaveLength(9)

    expectRows(
      await admin
        .from('event_responses')
        .insert({ ...row, response: 'available' })
        .select(),
      1,
    )
    const updated = expectRows(
      await admin
        .from('event_responses')
        .update({ response: 'unavailable', reason: 'Away this weekend' })
        .match(row)
        .select('response'),
      1,
    )
    expect(updated[0]).toEqual({ response: 'unavailable' })
    expectRows(await admin.from('event_responses').delete().match(row).select(), 1)
    expectEmpty(await admin.from('event_responses').select('*').match(row))
  })

  it("admin deletes a player's row; a manager of a different team cannot even see it", async () => {
    const admin = await signInAs('admin')
    const niamh = await signInAs('managerSeconds')
    const target = { event_id: EVENT.firsts.far.id, user_id: idOf('playerFirstsOther') }
    expectEmpty(await niamh.from('event_responses').delete().match(target).select())
    await expectRowUnchanged('event_responses', target, { response: 'available' })
    // Admin can; prove it and put the row back through the same policy.
    expectRows(await admin.from('event_responses').delete().match(target).select(), 1)
    expectRows(
      await admin
        .from('event_responses')
        .insert({ ...target, response: 'available' })
        .select(),
      1,
    )
  })
})

describe('membership, not just ownership, gates a response (D12)', () => {
  it('a Seconds player cannot respond to a Firsts event under their own id', async () => {
    const liam = await signInAs('playerSeconds')
    expectRlsDenied(
      await liam
        .from('event_responses')
        .insert({
          event_id: EVENT.firsts.far.id,
          user_id: idOf('playerSeconds'),
          response: 'available',
        })
        .select(),
    )
    await expectRowAbsent('event_responses', {
      event_id: EVENT.firsts.far.id,
      user_id: idOf('playerSeconds'),
    })
  })
})
