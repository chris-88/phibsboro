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
