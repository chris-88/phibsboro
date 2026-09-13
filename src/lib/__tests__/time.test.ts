import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatEventTime } from '@/lib/time'

// Every instant below is a fixed UTC string, exactly as PostgREST returns a timestamptz, and
// vitest.config.ts pins TZ=UTC (D53). The assertions are Dublin wall-clock, so they must also
// hold with the runner in any other zone; `node --input-type=module` under
// TZ=Pacific/Auckland is the manual check for AC12.

/** A Saturday in March 2026: Dublin is on GMT, so wall clock equals UTC. */
const MARCH = '2026-03-14T19:30:00Z'

describe('formatEventTime — the three styles (AC11)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('share, short and time for the same instant', () => {
    vi.useFakeTimers({ now: new Date('2026-09-13T12:00:00Z') })
    expect(formatEventTime(MARCH, 'share')).toBe('Saturday 14 March, 7.30pm')
    expect(formatEventTime(MARCH, 'short')).toBe('Sat 14 Mar, 7.30pm')
    expect(formatEventTime(MARCH, 'time')).toBe('7.30pm')
  })

  it('drops the minutes on the hour; midday is 12pm and midnight 12am', () => {
    expect(formatEventTime('2026-03-14T19:00:00Z', 'time')).toBe('7pm')
    expect(formatEventTime('2026-03-14T12:00:00Z', 'time')).toBe('12pm')
    expect(formatEventTime('2026-03-14T00:00:00Z', 'time')).toBe('12am')
    // 11:00Z in July is midday in Dublin.
    expect(formatEventTime('2026-07-10T11:00:00Z', 'time')).toBe('12pm')
  })

  it('pads single-digit minutes and never the hour', () => {
    expect(formatEventTime('2026-03-14T09:05:00Z', 'time')).toBe('9.05am')
    expect(formatEventTime('2026-03-01T09:05:00Z', 'short')).toBe('Sun 1 Mar, 9.05am')
  })

  it('accepts the exact strings PostgREST emits, with offset and microseconds', () => {
    expect(formatEventTime('2026-09-19T14:00:00+00:00', 'share')).toMatch(/^Saturday 19 September/)
    expect(formatEventTime('2026-09-19T14:00:00.123456+00:00', 'time')).toBe('3pm')
  })

  it('spells September "Sep", whatever ICU thinks', () => {
    expect(formatEventTime('2026-09-19T14:00:00Z', 'short')).toBe('Sat 19 Sep, 3pm')
  })

  it('throws on a string that is not a timestamp', () => {
    expect(() => formatEventTime('next Tuesday', 'time')).toThrow(RangeError)
  })
})

describe('formatEventTime — the year suffix (AC11)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('appends the year on share only, when the event is not in the current Dublin year', () => {
    vi.useFakeTimers({ now: new Date('2026-09-13T12:00:00Z') })
    expect(formatEventTime('2027-03-13T19:30:00Z', 'share')).toBe('Saturday 13 March 2027, 7.30pm')
    expect(formatEventTime('2027-03-13T19:30:00Z', 'short')).toBe('Sat 13 Mar, 7.30pm')
    expect(formatEventTime('2025-03-15T19:30:00Z', 'share')).toBe('Saturday 15 March 2025, 7.30pm')
  })

  it('computes "current year" on a Dublin calendar, not the runner\'s', () => {
    // Midday UTC on New Year's Eve: Auckland is already in 2027, Dublin is not.
    vi.useFakeTimers({ now: new Date('2026-12-31T12:00:00Z') })
    expect(formatEventTime('2026-12-31T19:30:00Z', 'share')).toBe('Thursday 31 December, 7.30pm')
    // Half past midnight in Dublin on 1 January: last night's event is now last year.
    vi.setSystemTime(new Date('2027-01-01T00:30:00Z'))
    expect(formatEventTime('2026-12-31T19:30:00Z', 'share')).toBe(
      'Thursday 31 December 2026, 7.30pm',
    )
  })
})

describe('formatEventTime — DST (AC12, D53)', () => {
  it('January is GMT: wall clock equals UTC', () => {
    expect(formatEventTime('2026-01-10T19:30:00Z', 'short')).toBe('Sat 10 Jan, 7.30pm')
  })

  it('July is IST: one hour ahead of UTC', () => {
    expect(formatEventTime('2026-07-10T19:30:00Z', 'short')).toBe('Fri 10 Jul, 8.30pm')
  })

  it('clocks go forward at 01:00 UTC on 29 March 2026', () => {
    expect(formatEventTime('2026-03-29T00:59:00Z', 'time')).toBe('12.59am')
    expect(formatEventTime('2026-03-29T01:00:00Z', 'time')).toBe('2am')
  })

  it('clocks go back at 01:00 UTC on 25 October 2026', () => {
    expect(formatEventTime('2026-10-25T00:59:00Z', 'time')).toBe('1.59am')
    expect(formatEventTime('2026-10-25T01:00:00Z', 'time')).toBe('1am')
  })

  it('an evening kick-off crossing midnight UTC lands on the right Dublin day', () => {
    // 23:30Z in July is 00:30 IST the next day.
    expect(formatEventTime('2026-07-10T23:30:00Z', 'short')).toBe('Sat 11 Jul, 12.30am')
  })
})
