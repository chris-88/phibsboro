import { describe, expect, it } from 'vitest'
import type { UpcomingEvent } from '@/api/events'
import {
  dateOfDayKey,
  dayKeyOfDate,
  dublinDayKey,
  dublinMonthRange,
  groupEventsByDay,
  monthDate,
  monthKeyOfDay,
  summariseDay,
} from '@/features/events/calendar-month'
import { TEAM_PALETTE } from '@/features/teams/palette'
import { utcIsoToDublinParts } from '@/lib/time'

/** Every test runs under TZ=UTC (vitest.config.ts, D53); the Dublin keys below therefore prove the
 *  grouping is on the Dublin calendar, not the runner's. */

const TEAM_A = '00000000-0000-4000-8000-0000000000a1'
const TEAM_B = '00000000-0000-4000-8000-0000000000b2'

function event(over: Partial<UpcomingEvent> = {}): UpcomingEvent {
  return {
    id: crypto.randomUUID(),
    teamId: TEAM_A,
    teamName: 'Firsts',
    type: 'match',
    title: 'A match',
    location: 'Bogies',
    startsAt: '2099-06-13T18:30:00+00:00',
    status: 'scheduled',
    myResponse: null,
    ...over,
  }
}

describe('dublinDayKey — grouping on the Dublin calendar', () => {
  it('keeps an evening summer kick-off on its own day (IST = UTC+1)', () => {
    // 22:30 UTC on 13 June is 23:30 Dublin, still the 13th.
    expect(dublinDayKey('2099-06-13T22:30:00+00:00')).toBe('2099-06-13')
  })

  it('rolls a late summer instant into the next Dublin day', () => {
    // 23:30 UTC on 13 June is 00:30 Dublin on the 14th (IST is an hour ahead).
    expect(dublinDayKey('2099-06-13T23:30:00+00:00')).toBe('2099-06-14')
  })

  it('uses the Dublin midnight boundary in winter (GMT = UTC+0)', () => {
    expect(dublinDayKey('2099-01-15T00:30:00+00:00')).toBe('2099-01-15')
    expect(dublinDayKey('2099-01-14T23:30:00+00:00')).toBe('2099-01-14')
  })
})

describe('monthKeyOfDay', () => {
  it('takes the YYYY-MM prefix', () => {
    expect(monthKeyOfDay('2099-06-13')).toBe('2099-06')
  })
})

describe('dayKeyOfDate / dateOfDayKey round-trip (react-day-picker coordinates)', () => {
  it('a day key becomes a Date and back to the same key', () => {
    expect(dayKeyOfDate(dateOfDayKey('2099-06-01'))).toBe('2099-06-01')
    expect(dayKeyOfDate(dateOfDayKey('2099-12-31'))).toBe('2099-12-31')
  })

  it('monthDate lands on the first of the month', () => {
    expect(dayKeyOfDate(monthDate('2099-06'))).toBe('2099-06-01')
  })
})

describe('dublinMonthRange — the month window sent to PostgREST', () => {
  it('spans the Dublin month start to the next Dublin month start', () => {
    const { startIso, endIso } = dublinMonthRange('2099-06')
    expect(utcIsoToDublinParts(startIso)).toEqual({ date: '2099-06-01', time: '00:00' })
    expect(utcIsoToDublinParts(endIso)).toEqual({ date: '2099-07-01', time: '00:00' })
  })

  it('rolls the year over for December', () => {
    const { startIso, endIso } = dublinMonthRange('2099-12')
    expect(utcIsoToDublinParts(startIso)).toEqual({ date: '2099-12-01', time: '00:00' })
    expect(utcIsoToDublinParts(endIso)).toEqual({ date: '2100-01-01', time: '00:00' })
  })
})

describe('groupEventsByDay', () => {
  it('buckets events under their Dublin day, in arrival order', () => {
    const a = event({ startsAt: '2099-06-13T18:30:00+00:00', title: 'first' })
    const b = event({ startsAt: '2099-06-13T20:00:00+00:00', title: 'second' })
    const c = event({ startsAt: '2099-06-14T10:00:00+00:00', title: 'other day' })
    const byDay = groupEventsByDay([a, b, c])
    expect(byDay.get('2099-06-13')?.map((e) => e.title)).toEqual(['first', 'second'])
    expect(byDay.get('2099-06-14')?.map((e) => e.title)).toEqual(['other day'])
    expect(byDay.has('2099-06-15')).toBe(false)
  })
})

describe('summariseDay — dots and overflow', () => {
  const COLOUR_A = TEAM_PALETTE[0].value
  const COLOUR_B = TEAM_PALETTE[1].value
  const colourForTeam = (teamId: string): string => (teamId === TEAM_A ? COLOUR_A : COLOUR_B)

  it('one dot per team in that team colour', () => {
    const summary = summariseDay(
      [event({ teamId: TEAM_A }), event({ teamId: TEAM_B })],
      colourForTeam,
    )
    expect(summary.dots).toEqual([
      { colour: COLOUR_A, cancelled: false },
      { colour: COLOUR_B, cancelled: false },
    ])
    expect(summary.overflow).toBe(0)
  })

  it('caps at three dots and counts the rest as overflow', () => {
    const summary = summariseDay([event(), event(), event(), event(), event()], colourForTeam)
    expect(summary.dots).toHaveLength(3)
    expect(summary.overflow).toBe(2)
  })

  it('flags a cancelled event so its dot renders hollow', () => {
    const summary = summariseDay([event({ status: 'cancelled' })], colourForTeam)
    expect(summary.dots[0]?.cancelled).toBe(true)
  })
})
