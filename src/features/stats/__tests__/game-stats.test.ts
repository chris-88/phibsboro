import { describe, expect, it } from 'vitest'
import {
  bumpCounter,
  buildGameStatsRows,
  clampCounter,
  clampMinutes,
  COUNTER_MAX,
  EMPTY_STAT,
} from '@/features/stats/game-stats'
import type { MatchStatsRow } from '@/features/stats/schema'

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const U3 = '33333333-3333-4333-8333-333333333333'

const statRow = (over: Partial<MatchStatsRow> & Pick<MatchStatsRow, 'user_id'>): MatchStatsRow => ({
  event_id: 'e',
  goals: 0,
  assists: 0,
  yellow_cards: 0,
  red_card: false,
  minutes: null,
  recorded_by: null,
  updated_at: '',
  ...over,
})

describe('clampCounter (S17.4)', () => {
  it('floors at zero and never goes negative', () => {
    expect(clampCounter('goals', -1)).toBe(0)
    expect(clampCounter('assists', -5)).toBe(0)
  })

  it('caps yellows at two (the DB check)', () => {
    expect(clampCounter('yellow_cards', 3)).toBe(2)
    expect(clampCounter('yellow_cards', 2)).toBe(2)
    expect(clampCounter('yellow_cards', 1)).toBe(1)
  })

  it('caps the open-ended counters at the sane ceiling and truncates', () => {
    expect(clampCounter('goals', COUNTER_MAX.goals + 10)).toBe(COUNTER_MAX.goals)
    expect(clampCounter('goals', 2.9)).toBe(2)
  })
})

describe('clampMinutes (S17.4)', () => {
  it('keeps null as "not entered"', () => {
    expect(clampMinutes(null)).toBeNull()
    expect(clampMinutes(Number.NaN)).toBeNull()
  })

  it('clamps to 0–200 (extra time allowed)', () => {
    expect(clampMinutes(-3)).toBe(0)
    expect(clampMinutes(90)).toBe(90)
    expect(clampMinutes(250)).toBe(200)
    expect(clampMinutes(90.7)).toBe(90)
  })
})

describe('bumpCounter (S17.4)', () => {
  it('adds the delta and returns a new object, clamped', () => {
    const next = bumpCounter(EMPTY_STAT, 'goals', 1)
    expect(next.goals).toBe(1)
    expect(next).not.toBe(EMPTY_STAT)
    expect(EMPTY_STAT.goals).toBe(0) // the input is untouched
  })

  it('a minus below zero stays at zero', () => {
    expect(bumpCounter(EMPTY_STAT, 'assists', -1).assists).toBe(0)
  })

  it('a third yellow is refused (clamped at two)', () => {
    const twoYellows = bumpCounter(bumpCounter(EMPTY_STAT, 'yellow_cards', 1), 'yellow_cards', 1)
    expect(twoYellows.yellow_cards).toBe(2)
    expect(bumpCounter(twoYellows, 'yellow_cards', 1).yellow_cards).toBe(2)
  })

  it('leaves the other fields alone', () => {
    const start = { goals: 1, assists: 2, yellow_cards: 0, red_card: true, minutes: 90 }
    const next = bumpCounter(start, 'goals', 1)
    expect(next).toEqual({ goals: 2, assists: 2, yellow_cards: 0, red_card: true, minutes: 90 })
  })
})

describe('buildGameStatsRows (S17.4)', () => {
  const names = new Map([
    [U1, 'Aaron Byrne'],
    [U2, 'Cathal Doyle'],
    // U3 intentionally absent — a since-removed member.
  ])
  const squad = [
    { user_id: U2, shirt_number: 9, is_captain: false },
    { user_id: U1, shirt_number: 4, is_captain: true },
    { user_id: U3, shirt_number: 11, is_captain: false },
  ]

  it('orders by shirt number, not squad order', () => {
    const rows = buildGameStatsRows(squad, [], names)
    expect(rows.map((r) => r.shirtNumber)).toEqual([4, 9, 11])
  })

  it('joins each player to their stat, defaulting a player with no row to zeros', () => {
    const rows = buildGameStatsRows(squad, [statRow({ user_id: U1, goals: 2, minutes: 90 })], names)
    const aaron = rows.find((r) => r.userId === U1)
    const cathal = rows.find((r) => r.userId === U2)
    expect(aaron?.stat.goals).toBe(2)
    expect(aaron?.stat.minutes).toBe(90)
    expect(aaron?.isCaptain).toBe(true)
    expect(cathal?.stat).toEqual(EMPTY_STAT)
  })

  it('reads a missing name as "Unknown" rather than dropping the row', () => {
    const rows = buildGameStatsRows(squad, [], names)
    expect(rows.find((r) => r.userId === U3)?.name).toBe('Unknown')
  })

  it('only builds rows for the picked squad, never all stat rows', () => {
    const strayStat = statRow({ user_id: 'not-in-squad', goals: 5 })
    const rows = buildGameStatsRows(squad, [strayStat], names)
    expect(rows).toHaveLength(3)
    expect(rows.some((r) => r.userId === 'not-in-squad')).toBe(false)
  })
})
