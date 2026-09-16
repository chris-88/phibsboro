import { describe, expect, it } from 'vitest'
import {
  clockPhase,
  clockRunning,
  clockSeconds,
  formatClock,
  nextAction,
  type MatchClock,
} from '@/features/stats/match-clock'

const EMPTY: MatchClock = {
  firstHalfKickoffAt: null,
  halfTimeAt: null,
  secondHalfKickoffAt: null,
  fullTimeAt: null,
}
const iso = (ms: number) => new Date(ms).toISOString()
const T0 = Date.UTC(2026, 8, 19, 13, 0, 0) // kick-off

describe('clockPhase (S18.3)', () => {
  it('reads back-to-front so the latest marker wins', () => {
    expect(clockPhase(EMPTY)).toBe('pre')
    expect(clockPhase({ ...EMPTY, firstHalfKickoffAt: iso(T0) })).toBe('first')
    expect(clockPhase({ ...EMPTY, firstHalfKickoffAt: iso(T0), halfTimeAt: iso(T0) })).toBe(
      'half-time',
    )
    expect(
      clockPhase({
        ...EMPTY,
        firstHalfKickoffAt: iso(T0),
        halfTimeAt: iso(T0),
        secondHalfKickoffAt: iso(T0),
      }),
    ).toBe('second')
    expect(
      clockPhase({
        firstHalfKickoffAt: iso(T0),
        halfTimeAt: iso(T0),
        secondHalfKickoffAt: iso(T0),
        fullTimeAt: iso(T0),
      }),
    ).toBe('full')
  })
})

describe('clockSeconds (S18.3)', () => {
  it('is null before kick-off', () => {
    expect(clockSeconds(EMPTY, T0 + 60_000)).toBeNull()
  })

  it('counts up from kick-off in the first half', () => {
    const c = { ...EMPTY, firstHalfKickoffAt: iso(T0) }
    expect(clockSeconds(c, T0 + 90_000)).toBe(90) // 1:30
  })

  it('freezes at the first-half span during half-time', () => {
    const c = { ...EMPTY, firstHalfKickoffAt: iso(T0), halfTimeAt: iso(T0 + 47 * 60_000) }
    // Frozen regardless of how much later "now" is.
    expect(clockSeconds(c, T0 + 60 * 60_000)).toBe(47 * 60)
  })

  it('counts the second half from 45:00 (broadcast convention)', () => {
    const c = {
      ...EMPTY,
      firstHalfKickoffAt: iso(T0),
      halfTimeAt: iso(T0 + 47 * 60_000),
      secondHalfKickoffAt: iso(T0 + 60 * 60_000),
    }
    // 2 minutes into the second half → 47:00, not 62:00.
    expect(clockSeconds(c, T0 + 62 * 60_000)).toBe(47 * 60)
  })

  it('freezes at full time', () => {
    const c = {
      firstHalfKickoffAt: iso(T0),
      halfTimeAt: iso(T0 + 47 * 60_000),
      secondHalfKickoffAt: iso(T0 + 60 * 60_000),
      fullTimeAt: iso(T0 + 108 * 60_000), // 48 min second half
    }
    expect(clockSeconds(c, T0 + 200 * 60_000)).toBe((45 + 48) * 60)
  })
})

describe('formatClock', () => {
  it('renders M:SS with a zero-padded second', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(90)).toBe('1:30')
    expect(formatClock(45 * 60)).toBe('45:00')
    expect(formatClock(93 * 60 + 5)).toBe('93:05')
  })
})

describe('clockRunning', () => {
  it('is true only while a half is live', () => {
    expect(clockRunning(EMPTY)).toBe(false)
    expect(clockRunning({ ...EMPTY, firstHalfKickoffAt: iso(T0) })).toBe(true)
    expect(clockRunning({ ...EMPTY, firstHalfKickoffAt: iso(T0), halfTimeAt: iso(T0) })).toBe(false)
    expect(
      clockRunning({
        ...EMPTY,
        firstHalfKickoffAt: iso(T0),
        halfTimeAt: iso(T0),
        secondHalfKickoffAt: iso(T0),
      }),
    ).toBe(true)
  })
})

describe('nextAction (S18.3)', () => {
  it('walks kick-off → half time → 2nd half → full time, then nothing', () => {
    let c = EMPTY
    expect(nextAction(c)).toEqual({ label: 'Kick off', field: 'firstHalfKickoffAt' })
    c = { ...c, firstHalfKickoffAt: iso(T0) }
    expect(nextAction(c)).toEqual({ label: 'Half time', field: 'halfTimeAt' })
    c = { ...c, halfTimeAt: iso(T0) }
    expect(nextAction(c)).toEqual({ label: 'Kick off 2nd half', field: 'secondHalfKickoffAt' })
    c = { ...c, secondHalfKickoffAt: iso(T0) }
    expect(nextAction(c)).toEqual({ label: 'Full time', field: 'fullTimeAt' })
    c = { ...c, fullTimeAt: iso(T0) }
    expect(nextAction(c)).toBeNull()
  })
})
