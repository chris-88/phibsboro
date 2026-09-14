import { z } from 'zod'
import { eventRowSchema } from '@/features/events/schema'
import type { Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

/** One row per player per event. No row means not recorded; clearing the toggle deletes (D25). */
export const attendanceRowSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  attended: z.boolean(),
  recorded_by: uuidSchema.nullable(),
  updated_at: timestampSchema,
})
export type AttendanceRow = z.infer<typeof attendanceRowSchema>

export type Parity = [Expect<Equal<AttendanceRow, Tables<'attendance'>>>]

// —— The history read (S3.5) ————————————————————————————————————————————————
// The player's own attendance the manager wrote down, one word per past event. Three states, not
// two: absence of a row is "not recorded", never a stored value (D25). The manager's controls
// (S4.4, S4.5) label the same three `Not recorded | Attended | Absent`, so a player and a manager
// describing the same row say the same word.

/** The three attendance states a row can be in, mirroring the manager control's vocabulary. */
export type AttendanceState = 'attended' | 'absent' | 'not-recorded'

/** The word each state reads as, shared by the pill and the row's accessible name so the two never
 *  drift. The manager control (S4.4, S4.5) uses the same three words. */
export const ATTENDANCE_LABEL: Record<AttendanceState, string> = {
  attended: 'Attended',
  absent: 'Absent',
  'not-recorded': 'Not recorded',
}

/**
 * One row of the S3.5 history read. Derived from `eventRowSchema` (S1.5 AC18), never written as a
 * second literal. The embed comes back as `attendance: { attended }[]` of length 0 or 1 — RLS keys
 * the player select policy on `user_id = auth.uid()`, so the array holds at most the caller's own
 * row (D33). The transform collapses it to one of the three states, so no component ever sees an
 * array. `.max(1)` is not decoration: it fails the boundary parse loudly if that policy ever
 * widens and the embed returns the whole squad.
 */
export const historyRowSchema = eventRowSchema
  .pick({ id: true, team_id: true, type: true, title: true, starts_at: true, status: true })
  .extend({ attendance: z.array(z.object({ attended: z.boolean() })).max(1) })
  .transform(({ attendance, ...row }) => {
    // noUncheckedIndexedAccess is on, so the undefined branch is required by the compiler. The
    // explicit annotation pins the literal union: transform return-type inference would otherwise
    // widen it to `string`.
    const first = attendance[0]
    const state: AttendanceState =
      first === undefined ? 'not-recorded' : first.attended ? 'attended' : 'absent'
    return { ...row, attendance: state }
  })
export type HistoryRow = z.infer<typeof historyRowSchema>
