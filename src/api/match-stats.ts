import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { eventKeys, statsKeys } from '@/api/queryKeys'
import { eventRowSchema, type EventType } from '@/features/events/schema'
import { useSession } from '@/features/auth/session-context'
import type { Update } from '@/lib/db'
import { matchStatsRowSchema, type MatchStatsRow } from '@/features/stats/schema'
import type { PlayerStat } from '@/features/stats/game-stats'
import type { ClockField } from '@/features/stats/match-clock'
import { supabase } from '@/lib/supabase'

/**
 * The S17.4 game-stats data layer (X4/X5). Three reads/writes behind the collection screen: the
 * match header (title, MOTM, score), the per-player `match_stats` rows, and the two writes — a
 * per-player stat upsert and the MOTM/score update on the event. Both writes are optimistic (D48,
 * mirroring `attendance`), so a tap on the sideline lands under the thumb before the row returns.
 * The write policy on `match_stats` (and `events`) is manager/admin-only, so a player is refused in
 * the DB, not just the UI (X6, S17.3).
 */

// ---- The match header (event columns MOTM/score live on `events`, X4) --------------------------

/** Just what the collection screen's header needs; a subset of the event row, camel-cased —
 *  including the four match-clock markers (S18.3), from which the screen derives the live minute. */
export interface MatchForStats {
  id: string
  teamId: string
  type: EventType
  title: string
  startsAt: string
  motmUserId: string | null
  scoreUs: number | null
  scoreThem: number | null
  firstHalfKickoffAt: string | null
  halfTimeAt: string | null
  secondHalfKickoffAt: string | null
  fullTimeAt: string | null
}

const MATCH_SELECT =
  'id, team_id, type, title, starts_at, motm_user_id, score_us, score_them, first_half_kickoff_at, half_time_at, second_half_kickoff_at, full_time_at'
/** Parse only the columns we selected, derived from the event row schema (never a second literal). */
const matchForStatsSchema = eventRowSchema.pick({
  id: true,
  team_id: true,
  type: true,
  title: true,
  starts_at: true,
  motm_user_id: true,
  score_us: true,
  score_them: true,
  first_half_kickoff_at: true,
  half_time_at: true,
  second_half_kickoff_at: true,
  full_time_at: true,
})

/**
 * The match header. `null` when the id is unknown or the caller can't read it (RLS returns no row,
 * not an error) — the screen shows "not found". Keyed under `eventKeys.match`, beneath
 * `eventKeys.all`, so an event edit elsewhere reaches it.
 */
export function useMatchForStats(
  eventId: string | undefined,
): UseQueryResult<MatchForStats | null> {
  return useQuery({
    queryKey: eventKeys.match(eventId ?? ''),
    enabled: eventId !== undefined,
    queryFn: async (): Promise<MatchForStats | null> => {
      if (!eventId) return null
      const { data, error } = await supabase
        .from('events')
        .select(MATCH_SELECT)
        .eq('id', eventId)
        .maybeSingle()
      if (error) throw error
      if (data === null) return null
      const row = matchForStatsSchema.parse(data)
      return {
        id: row.id,
        teamId: row.team_id,
        type: row.type,
        title: row.title,
        startsAt: row.starts_at,
        motmUserId: row.motm_user_id,
        scoreUs: row.score_us,
        scoreThem: row.score_them,
        firstHalfKickoffAt: row.first_half_kickoff_at,
        halfTimeAt: row.half_time_at,
        secondHalfKickoffAt: row.second_half_kickoff_at,
        fullTimeAt: row.full_time_at,
      }
    },
  })
}

// ---- The per-player match_stats rows -----------------------------------------------------------

/** Every `match_stats` row for one match. A manager reads the whole squad's rows; RLS narrows a
 *  player to their own — but only a manager reaches this screen (the route is guarded), so this is
 *  the squad. Parsed at the boundary, so a PostgREST shape change fails here. */
export function useMatchStats(eventId: string | undefined): UseQueryResult<MatchStatsRow[]> {
  return useQuery({
    queryKey: statsKeys.match(eventId ?? ''),
    enabled: eventId !== undefined,
    queryFn: async (): Promise<MatchStatsRow[]> => {
      if (!eventId) return []
      const { data, error } = await supabase.from('match_stats').select('*').eq('event_id', eventId)
      if (error) throw error
      return z.array(matchStatsRowSchema).parse(data)
    },
  })
}

// ---- Write one player's stat (optimistic upsert) -----------------------------------------------

interface StatContext {
  previous: MatchStatsRow[] | undefined
}
export interface SetMatchStatInput {
  userId: string
  stat: PlayerStat
}

/** The optimistic row written before the upsert settles. `recorded_by`/`updated_at` are audit the
 *  screen never renders, so a placeholder stands in until the settle refetch replaces the row. */
function optimisticStat(
  previous: MatchStatsRow[],
  eventId: string,
  { userId, stat }: SetMatchStatInput,
): MatchStatsRow[] {
  const existing = previous.find((r) => r.user_id === userId)
  const next: MatchStatsRow = {
    event_id: eventId,
    user_id: userId,
    goals: stat.goals,
    assists: stat.assists,
    yellow_cards: stat.yellow_cards,
    red_card: stat.red_card,
    minutes: stat.minutes,
    recorded_by: existing?.recorded_by ?? null,
    updated_at: existing?.updated_at ?? '',
  }
  return [...previous.filter((r) => r.user_id !== userId), next]
}

/**
 * Upsert one player's stats (AC2, AC4). One row per `(event_id, user_id)`, so a re-tap of an old
 * match updates the same row, never duplicates. `recorded_by` is the writer's uid (audit), set
 * client-side; the RLS insert/update check is what authorises. Optimistic on `statsKeys.match`,
 * rolled back on refusal, re-synced on settle — and `statsKeys.all` on settle so Performance
 * (which aggregates these) refreshes.
 */
export function useSetMatchStat(
  eventId: string,
): UseMutationResult<void, PostgrestError, SetMatchStatInput, StatContext> {
  const qc = useQueryClient()
  const session = useSession()
  const recordedBy = session.status === 'signedIn' ? session.session.user.id : null
  return useMutation({
    mutationFn: async ({ userId, stat }) => {
      const { error } = await supabase.from('match_stats').upsert(
        {
          event_id: eventId,
          user_id: userId,
          goals: stat.goals,
          assists: stat.assists,
          yellow_cards: stat.yellow_cards,
          red_card: stat.red_card,
          minutes: stat.minutes,
          recorded_by: recordedBy,
        },
        { onConflict: 'event_id,user_id' },
      )
      if (error) throw error
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: statsKeys.match(eventId) })
      const previous = qc.getQueryData<MatchStatsRow[]>(statsKeys.match(eventId))
      if (previous) {
        qc.setQueryData<MatchStatsRow[]>(
          statsKeys.match(eventId),
          optimisticStat(previous, eventId, input),
        )
      }
      return { previous }
    },
    onError: (_error, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(statsKeys.match(eventId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: statsKeys.all })
    },
  })
}

// ---- Write MOTM / score on the event (optimistic) ----------------------------------------------

interface MetaContext {
  previous: MatchForStats | null | undefined
}
/** A partial patch: only the keys present are written, so `motmUserId: null` clears MOTM while an
 *  absent key leaves it. Camel-cased for the cache; mapped to the event columns for the update. */
export interface SetMatchMetaInput {
  motmUserId?: string | null
  scoreUs?: number | null
  scoreThem?: number | null
}

/**
 * Set the man of the match and/or the final score (AC3). Writes `events.motm_user_id` /
 * `score_us` / `score_them` directly (manager/admin under RLS). Optimistic on `eventKeys.match`;
 * on settle re-syncs that header and `statsKeys.all` (MOTM feeds the Performance leaderboard).
 */
export function useSetMatchMeta(
  eventId: string,
): UseMutationResult<void, PostgrestError, SetMatchMetaInput, MetaContext> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input) => {
      const patch: Update<'events'> = {}
      if ('motmUserId' in input) patch.motm_user_id = input.motmUserId
      if ('scoreUs' in input) patch.score_us = input.scoreUs
      if ('scoreThem' in input) patch.score_them = input.scoreThem
      const { error } = await supabase.from('events').update(patch).eq('id', eventId)
      if (error) throw error
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: eventKeys.match(eventId) })
      const previous = qc.getQueryData<MatchForStats | null>(eventKeys.match(eventId))
      if (previous) {
        const patch: Partial<MatchForStats> = {}
        if ('motmUserId' in input) patch.motmUserId = input.motmUserId ?? null
        if ('scoreUs' in input) patch.scoreUs = input.scoreUs ?? null
        if ('scoreThem' in input) patch.scoreThem = input.scoreThem ?? null
        qc.setQueryData<MatchForStats | null>(eventKeys.match(eventId), { ...previous, ...patch })
      }
      return { previous }
    },
    onError: (_error, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(eventKeys.match(eventId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.match(eventId) })
      void qc.invalidateQueries({ queryKey: statsKeys.all })
    },
  })
}

// ---- The match clock (S18.3) -------------------------------------------------------------------

/** The four event columns the clock writes. */
type ClockColumn =
  'first_half_kickoff_at' | 'half_time_at' | 'second_half_kickoff_at' | 'full_time_at'

/** Camel marker → the event column it writes. */
const CLOCK_COLUMN: Record<ClockField, ClockColumn> = {
  firstHalfKickoffAt: 'first_half_kickoff_at',
  halfTimeAt: 'half_time_at',
  secondHalfKickoffAt: 'second_half_kickoff_at',
  fullTimeAt: 'full_time_at',
}

/** A patch of clock markers: a marker set to an ISO time (an advance) or to null (a reset). */
export type MatchClockPatch = Partial<Record<ClockField, string | null>>

/**
 * Advance or reset the manual match clock (S18.3). Writes the period markers on the event directly
 * (manager/admin under RLS, the same path as MOTM/score), so the clock survives a reload and reads
 * the same everywhere. Optimistic on `eventKeys.match`; the running minute is derived on the screen,
 * so a marker landing is all this has to persist.
 */
export function useSetMatchClock(
  eventId: string,
): UseMutationResult<void, PostgrestError, MatchClockPatch, MetaContext> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch) => {
      const update: Partial<Record<ClockColumn, string | null>> = {}
      for (const key of Object.keys(patch) as ClockField[]) {
        const value = patch[key]
        if (value !== undefined) update[CLOCK_COLUMN[key]] = value
      }
      const { error } = await supabase.from('events').update(update).eq('id', eventId)
      if (error) throw error
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: eventKeys.match(eventId) })
      const previous = qc.getQueryData<MatchForStats | null>(eventKeys.match(eventId))
      if (previous) {
        qc.setQueryData<MatchForStats | null>(eventKeys.match(eventId), { ...previous, ...patch })
      }
      return { previous }
    },
    onError: (_error, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(eventKeys.match(eventId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.match(eventId) })
    },
  })
}
