import { z } from 'zod'
import type { Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

/**
 * One player's stats for one match (S17.3, X4). The manager fills it live and can edit it after; a
 * player reads only their own row (X8). `minutes` is nullable (unknown until entered); the counters
 * default to 0. Derived from the generated type via the parity assertion, never a second literal.
 */
export const matchStatsRowSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  goals: z.number().int(),
  assists: z.number().int(),
  yellow_cards: z.number().int(),
  red_card: z.boolean(),
  minutes: z.number().int().nullable(),
  recorded_by: uuidSchema.nullable(),
  updated_at: timestampSchema,
})
export type MatchStatsRow = z.infer<typeof matchStatsRowSchema>

export type Parity = [Expect<Equal<MatchStatsRow, Tables<'match_stats'>>>]

/** One row of `attendance_stats` (S17.5). Snake-case from the RPC; the hook maps to the view. */
export const attendanceStatRowSchema = z.object({
  user_id: uuidSchema,
  name: z.string(),
  games_total: z.number().int(),
  games_attended: z.number().int(),
  training_total: z.number().int(),
  training_attended: z.number().int(),
  responded: z.number().int(),
  invited: z.number().int(),
})
export type AttendanceStatRow = z.infer<typeof attendanceStatRowSchema>

/** One row of `performance_stats` (S17.6). */
export const performanceStatRowSchema = z.object({
  user_id: uuidSchema,
  name: z.string(),
  appearances: z.number().int(),
  goals: z.number().int(),
  assists: z.number().int(),
  yellow_cards: z.number().int(),
  red_cards: z.number().int(),
  minutes: z.number().int(),
  motm: z.number().int(),
})
export type PerformanceStatRow = z.infer<typeof performanceStatRowSchema>
