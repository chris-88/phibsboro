import { z } from 'zod'
import { availabilityResponseSchema } from '@/features/availability/schema'
import type { Enums, FnRow, Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

export const eventTypeSchema = z.enum(['training', 'match'])
export const eventStatusSchema = z.enum(['scheduled', 'cancelled'])

export type EventType = z.infer<typeof eventTypeSchema>
export type EventStatus = z.infer<typeof eventStatusSchema>

/**
 * The `events` row, column for column (data-model.md). The string bounds mirror the SQL checks
 * so a form fails inline rather than on the wire.
 *
 * Form schemas are DERIVED from this object, never written as a second literal (S1.5 AC18).
 * The worked case, which S4.1 ships:
 *
 *   export const eventFormSchema = eventRowSchema
 *     .pick({ type: true, title: true, location: true, notes: true })
 *     .extend({ date: z.string().date(), time: z.string().regex(/^\d{2}:\d{2}$/) })
 *
 * A reviewer of any later form story can point at the `.pick()` / `.omit()` / `.extend()` /
 * `.partial()` chain back to the row schema, or reject the PR.
 */
export const eventRowSchema = z.object({
  id: uuidSchema,
  team_id: uuidSchema,
  type: eventTypeSchema,
  title: z.string().trim().min(1).max(80),
  location: z.string().trim().min(1).max(120),
  notes: z.string().max(500).nullable(),
  starts_at: timestampSchema,
  status: eventStatusSchema,
  series_id: uuidSchema.nullable(),
  created_by: uuidSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})
export type EventRow = z.infer<typeof eventRowSchema>

/**
 * The member read for the event detail screen (S3.3): the event columns, the team name from an
 * inner join, and the caller's own response embedded. The embed is filtered to `auth.uid()` in
 * the query, so `.max(1)` is not decoration — it fails loudly in a test if that filter is ever
 * dropped and a manager's read returns the whole squad (D32, AC15).
 */
export const eventWithResponseSchema = eventRowSchema
  .pick({
    id: true,
    team_id: true,
    type: true,
    title: true,
    location: true,
    notes: true,
    starts_at: true,
    status: true,
  })
  .extend({
    teams: z.object({ name: z.string() }),
    event_responses: z.array(z.object({ response: availabilityResponseSchema })).max(1),
  })
export type EventWithResponseRow = z.infer<typeof eventWithResponseSchema>

/** What `get_event_preview` returns to anyone, signed in or not (D7). Never `notes`. */
export const eventPreviewSchema = eventRowSchema
  .pick({ team_id: true, type: true, title: true, location: true, starts_at: true, status: true })
  .extend({ team_name: z.string() })
export type EventPreview = z.infer<typeof eventPreviewSchema>

/** Compile-time parity with the generated types (D24, S1.5 AC2, AC3). */
export type Parity = [
  Expect<Equal<EventType, Enums<'event_type'>>>,
  Expect<Equal<EventStatus, Enums<'event_status'>>>,
  Expect<Equal<EventRow, Tables<'events'>>>,
  Expect<Equal<EventPreview, FnRow<'get_event_preview'>>>,
]
