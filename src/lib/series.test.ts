import { describe, expect, it } from 'vitest'
import { weeklySlots } from '@/lib/series'
import { formatEventTime } from '@/lib/time'

// TZ is pinned to UTC in vitest.config.ts (D53), so these fixed instants mean the same thing in
// January and July. All arithmetic is Dublin wall-clock, proven by formatEventTime.

describe('weeklySlots', () => {
  it('returns one slot per week, the first equal to the input, at minute resolution', () => {
    const first = '2026-09-15T18:30:00.000Z' // 7.30pm Dublin (IST)
    const slots = weeklySlots(first, 12)
    expect(slots).toHaveLength(12)
    expect(slots[0]).toBe(first)
  })

  it('weeks = 1 returns the input alone', () => {
    expect(weeklySlots('2026-02-03T19:30:00.000Z', 1)).toEqual(['2026-02-03T19:30:00.000Z'])
  })

  it('keeps 7.30pm at 7.30pm across the March spring-forward', () => {
    // First is a February Tuesday, 7.30pm GMT (offset 0). April sessions are 7.30pm IST (offset +1).
    const slots = weeklySlots('2026-02-03T19:30:00.000Z', 13)
    expect(new Set(slots.map((s) => formatEventTime(s, 'time'))).size).toBe(1)
    expect(formatEventTime(slots[0] ?? '', 'time')).toBe('7.30pm')
    // Before the change: stored as 19:30 UTC. After: 18:30 UTC, an hour earlier in absolute time.
    expect(slots[7]).toBe('2026-03-24T19:30:00.000Z') // still GMT
    expect(slots[8]).toBe('2026-03-31T18:30:00.000Z') // first Tuesday after the change, IST
    expect(slots[12]).toBe('2026-04-28T18:30:00.000Z')
  })

  it('keeps 7.30pm at 7.30pm across the October fall-back', () => {
    // First is a summer Tuesday, 7.30pm IST. November sessions are 7.30pm GMT.
    const slots = weeklySlots('2026-10-06T18:30:00.000Z', 6)
    expect(new Set(slots.map((s) => formatEventTime(s, 'time'))).size).toBe(1)
    expect(slots[2]).toBe('2026-10-20T18:30:00.000Z') // still IST
    expect(slots[3]).toBe('2026-10-27T19:30:00.000Z') // first Tuesday after the change, GMT
  })

  it('throws outside 1..16 and on a non-integer', () => {
    expect(() => weeklySlots('2026-09-15T18:30:00.000Z', 17)).toThrow(RangeError)
    expect(() => weeklySlots('2026-09-15T18:30:00.000Z', 0)).toThrow(RangeError)
    expect(() => weeklySlots('2026-09-15T18:30:00.000Z', 1.5)).toThrow(RangeError)
  })
})
