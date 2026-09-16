import type { MatchStatsRow } from '@/features/stats/schema'

/**
 * The pure core of the S17.4 game-stats collection screen (X5). The screen is a live-write UI on
 * the sideline, so its arithmetic — the per-player row model, the counter clamps — lives here where
 * a unit test pins it, and the component only wires taps to mutations.
 */

/** The counters a manager taps up and down per player. `red_card` is a toggle, `minutes` an input,
 *  so neither is a "counter" here. */
export type Counter = 'goals' | 'assists' | 'yellow_cards'

/** The DB checks are the real bounds (goals/assists `>= 0`, yellows `0..2`, minutes `0..200`). The
 *  UI clamps to the same, plus a sane ceiling on the open-ended counters so a fat-fingered hold
 *  can't run away. */
export const COUNTER_MAX: Record<Counter, number> = {
  goals: 99,
  assists: 99,
  yellow_cards: 2,
}
export const MINUTES_MIN = 0
export const MINUTES_MAX = 200

/** Clamp a counter to `[0, COUNTER_MAX]`. Used on every +/- so a value never leaves the DB range. */
export function clampCounter(field: Counter, value: number): number {
  return Math.max(0, Math.min(COUNTER_MAX[field], Math.trunc(value)))
}

/** Clamp minutes to `[0, 200]` (ET allowed), or `null` for "not entered". A blank input is null. */
export function clampMinutes(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null
  return Math.max(MINUTES_MIN, Math.min(MINUTES_MAX, Math.trunc(value)))
}

/** The stat values for one player, the shape the upsert writes. Zeroed for a player with no row
 *  yet, so every squad member is editable from the first tap. */
export interface PlayerStat {
  goals: number
  assists: number
  yellow_cards: number
  red_card: boolean
  minutes: number | null
}

export const EMPTY_STAT: PlayerStat = {
  goals: 0,
  assists: 0,
  yellow_cards: 0,
  red_card: false,
  minutes: null,
}

/** One row of the collection screen: a picked player and their current stat. */
export interface GameStatsRow {
  userId: string
  name: string
  shirtNumber: number
  isCaptain: boolean
  stat: PlayerStat
}

/** The picked squad, shirt-ordered, joined to whatever stats exist and to member names. The pool
 *  is the selected side (`event_squad`, S9.2) — non-squad players never appear (X5). A missing
 *  stat row reads as {@link EMPTY_STAT}; a missing name (a since-removed member) as "Unknown". */
export function buildGameStatsRows(
  squad: readonly { user_id: string; shirt_number: number; is_captain: boolean }[],
  stats: readonly MatchStatsRow[],
  nameByUser: ReadonlyMap<string, string>,
): GameStatsRow[] {
  const statByUser = new Map(stats.map((s) => [s.user_id, s]))
  return [...squad]
    .sort((a, b) => a.shirt_number - b.shirt_number)
    .map((s) => {
      const row = statByUser.get(s.user_id)
      const stat: PlayerStat = row
        ? {
            goals: row.goals,
            assists: row.assists,
            yellow_cards: row.yellow_cards,
            red_card: row.red_card,
            minutes: row.minutes,
          }
        : EMPTY_STAT
      return {
        userId: s.user_id,
        name: nameByUser.get(s.user_id) ?? 'Unknown',
        shirtNumber: s.shirt_number,
        isCaptain: s.is_captain,
        stat,
      }
    })
}

/** Apply a counter delta to a stat, clamped — the value the upsert then writes. Pure, so the
 *  screen's "tap +1 goal" is one call the test can assert. */
export function bumpCounter(stat: PlayerStat, field: Counter, delta: number): PlayerStat {
  return { ...stat, [field]: clampCounter(field, stat[field] + delta) }
}
