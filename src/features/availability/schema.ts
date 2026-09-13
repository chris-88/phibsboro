import { z } from 'zod'
import type { Enums, Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

export const availabilityResponseSchema = z.enum(['available', 'unavailable'])
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>

/** One row per player per event. No row means awaiting; that is never stored (D25). */
export const eventResponseRowSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  response: availabilityResponseSchema,
  updated_at: timestampSchema,
})
export type EventResponseRow = z.infer<typeof eventResponseRowSchema>

export type Parity = [
  Expect<Equal<AvailabilityResponse, Enums<'availability_response'>>>,
  Expect<Equal<EventResponseRow, Tables<'event_responses'>>>,
]
