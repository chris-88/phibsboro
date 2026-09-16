import { z } from 'zod'
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

// —— Attendance states ———————————————————————————————————————————————————————
// One word per player per event, shared by the manager controls (S4.4, S4.5) and the S4.4 pill.
// Three states, not two: absence of a row is "not recorded", never a stored value (D25), so a
// manager reading and a manager recording the same row say the same word.

/** The three attendance states a row can be in, mirroring the manager control's vocabulary. */
export type AttendanceState = 'attended' | 'absent' | 'not-recorded'

/** The word each state reads as, shared by the pill and the row's accessible name so the two never
 *  drift. The manager control (S4.4, S4.5) uses the same three words. */
export const ATTENDANCE_LABEL: Record<AttendanceState, string> = {
  attended: 'Attended',
  absent: 'Absent',
  'not-recorded': 'Not recorded',
}
