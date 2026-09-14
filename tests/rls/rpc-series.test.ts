// Row 37: generate_training_series (D30). Concrete weekly rows sharing a series_id, idempotent
// against the partial unique index, capped at 16 weeks, never in the past, managers only.
import { afterAll, describe, expect, it } from 'vitest'

import { deleteSeries, setTeamActive } from './helpers/arrange.ts'
import { anonClient, signInAs } from './helpers/clients.ts'
import { FIRSTS, SECONDS } from './helpers/fixtures.ts'
import { expectNoExecute, expectRows, expectRpcError } from './helpers/expect.ts'
import { weeklySlots } from '../../src/lib/series.ts'
import { formatEventTime } from '../../src/lib/time.ts'

const seriesIds = new Set<string>()
const weeksOut = (n: number) => new Date(Date.now() + n * 7 * 86_400_000).toISOString()

afterAll(async () => {
  await setTeamActive(FIRSTS, true)
  for (const id of seriesIds) await deleteSeries(id)
})

const args = (team: string, first: string, weeks: number) => ({
  p_team_id: team,
  p_first_starts_at: first,
  p_weeks: weeks,
  p_title: 'Tuesday training',
  p_location: 'Dalymount Park',
})

describe('row 37 — generate_training_series', () => {
  it('manager generates 4 weekly rows sharing a series_id; re-running the same window adds none', async () => {
    const declan = await signInAs('managerFirsts')
    const first = weeksOut(4)
    const { data, error } = await declan.rpc('generate_training_series', args(FIRSTS, first, 4))
    expect(error).toBeNull()
    expect(data).toHaveLength(4)
    const ids = data ?? []

    const rows = expectRows(
      await declan
        .from('events')
        .select('id, series_id, type, title, location, starts_at, team_id')
        .in('id', ids)
        .order('starts_at'),
      4,
    )
    const seriesId = rows[0]?.series_id
    expect(seriesId).toBeTruthy()
    if (seriesId) seriesIds.add(seriesId)
    expect(
      rows.every((r) => r.series_id === seriesId && r.type === 'training' && r.team_id === FIRSTS),
    ).toBe(true)
    expect(
      rows.every((r) => r.title === 'Tuesday training' && r.location === 'Dalymount Park'),
    ).toBe(true)
    // Weeks are added in Dublin wall-clock time, so the time of day is identical every week even
    // across the late-October clock change; the raw UTC gap is therefore not a constant 168h and
    // must not be asserted (S4.6, AC6, D35). The client twin agrees with the function week for
    // week, so the two arithmetics cannot drift (S4.6 test plan).
    expect(new Set(rows.map((r) => formatEventTime(r.starts_at, 'time'))).size).toBe(1)
    expect(rows.map((r) => formatEventTime(r.starts_at, 'share'))).toEqual(
      weeklySlots(first, 4).map((s) => formatEventTime(s, 'share')),
    )

    const again = await declan.rpc('generate_training_series', args(FIRSTS, first, 4))
    expect(again.error).toBeNull()
    expect(again.data).toEqual([])
    expectRows(
      await declan
        .from('events')
        .select('id')
        .eq('series_id', seriesId ?? ''),
      4,
    )

    // An overlapping six-week window adds exactly the two new slots, under a new series_id.
    const overlap = await declan.rpc('generate_training_series', args(FIRSTS, first, 6))
    expect(overlap.error).toBeNull()
    expect(overlap.data).toHaveLength(2)
    const extra = expectRows(
      await declan
        .from('events')
        .select('series_id')
        .in('id', overlap.data ?? []),
      2,
    )
    for (const r of extra) if (r.series_id) seriesIds.add(r.series_id)
  })

  it('a blank title defaults to Training', async () => {
    const declan = await signInAs('managerFirsts')
    const { data, error } = await declan.rpc('generate_training_series', {
      ...args(FIRSTS, weeksOut(20), 1),
      p_title: '   ',
    })
    expect(error).toBeNull()
    const rows = expectRows(
      await declan
        .from('events')
        .select('title, series_id')
        .in('id', data ?? []),
      1,
    )
    expect(rows[0]?.title).toBe('Training')
    if (rows[0]?.series_id) seriesIds.add(rows[0].series_id)
  })

  it('p_weeks = 20 raises series_too_long, and so does 17 and 0', async () => {
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('generate_training_series', args(FIRSTS, weeksOut(30), 20)),
      'series_too_long',
    )
    expectRpcError(
      await declan.rpc('generate_training_series', args(FIRSTS, weeksOut(30), 17)),
      'series_too_long',
    )
    expectRpcError(
      await declan.rpc('generate_training_series', args(FIRSTS, weeksOut(30), 0)),
      'series_too_long',
    )
    expect(
      (await declan.rpc('generate_training_series', args(FIRSTS, weeksOut(30), 16))).error,
    ).toBeNull()
    const rows = expectRows(
      await declan
        .from('events')
        .select('series_id')
        .eq('title', 'Tuesday training')
        .gte('starts_at', weeksOut(29)),
      16,
    )
    if (rows[0]?.series_id) seriesIds.add(rows[0].series_id)
  })

  it('a first session in the past raises starts_in_past', async () => {
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('generate_training_series', args(FIRSTS, '2020-01-07T19:00:00Z', 4)),
      'starts_in_past',
    )
    expectRpcError(
      await declan.rpc(
        'generate_training_series',
        args(FIRSTS, new Date(Date.now() - 60_000).toISOString(), 4),
      ),
      'starts_in_past',
    )
  })

  it('a blank location raises not_authorised rather than a constraint name', async () => {
    const declan = await signInAs('managerFirsts')
    const res = await declan.rpc('generate_training_series', {
      ...args(FIRSTS, weeksOut(40), 2),
      p_location: '  ',
    })
    expectRpcError(res, 'not_authorised')
  })

  it('player, stranger and the other manager raise not_authorised', async () => {
    for (const fixture of ['playerFirsts', 'stranger', 'managerSeconds'] as const) {
      const client = await signInAs(fixture)
      expectRpcError(
        await client.rpc('generate_training_series', args(FIRSTS, weeksOut(50), 2)),
        'not_authorised',
      )
    }
    const declan = await signInAs('managerFirsts')
    expectRpcError(
      await declan.rpc('generate_training_series', args(SECONDS, weeksOut(50), 2)),
      'not_authorised',
    )
  })

  it('an inactive team raises not_authorised', async () => {
    const declan = await signInAs('managerFirsts')
    await setTeamActive(FIRSTS, false)
    try {
      expectRpcError(
        await declan.rpc('generate_training_series', args(FIRSTS, weeksOut(50), 2)),
        'not_authorised',
      )
    } finally {
      await setTeamActive(FIRSTS, true)
    }
  })

  it('admin generates on a team they are not a member of', async () => {
    const admin = await signInAs('admin')
    const { data, error } = await admin.rpc(
      'generate_training_series',
      args(SECONDS, weeksOut(60), 3),
    )
    expect(error).toBeNull()
    expect(data).toHaveLength(3)
    const rows = expectRows(
      await admin
        .from('events')
        .select('series_id')
        .in('id', data ?? []),
      3,
    )
    if (rows[0]?.series_id) seriesIds.add(rows[0].series_id)
  })

  it('anon cannot execute generate_training_series', async () => {
    expectNoExecute(
      await anonClient().rpc('generate_training_series', args(FIRSTS, weeksOut(70), 2)),
    )
  })
})
