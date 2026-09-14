import { z } from 'zod'
import { availabilityResponseSchema } from '@/features/availability/schema'
import type { Enums, FnRow, Insert, Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { dublinLocalToUtcIso } from '@/lib/time'
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

// —— The create/edit form (S4.1) ————————————————————————————————————————————
// Derived from eventRowSchema, never written as a second literal (S1.5 AC18): the four shared
// columns are picked off the row, and `date` + `time` replace the composed `starts_at`. S4.6
// adds its series schema to this same file.

/** True when switching type should overwrite the title: only when the field is empty or still
 *  holds the other type's default label. A manager who typed "Kilbarrack away" keeps it (AC2). */
export function shouldRewriteTitle(current: string, nextType: EventType): boolean {
  const trimmed = current.trim()
  if (trimmed === '') return true
  const otherType: EventType = nextType === 'training' ? 'match' : 'training'
  return trimmed === DEFAULT_TITLES[otherType]
}

/** The default title per type. "Training" for training (AC2). */
export const DEFAULT_TITLES: Record<EventType, string> = {
  training: 'Training',
  match: 'Match',
} as const

/** One year, the typo guard that catches `2206` for `2026` (AC6). Not a product rule. */
const HORIZON_MS = 365 * 24 * 60 * 60 * 1000

/**
 * A factory, not a bare schema, for two reasons the ACs pin. `requireFuture` is off when S4.2
 * edits an event whose start is not moving; `now` is injected — `serverNow()` in the app (D48),
 * a fixed instant in the unit tests — so the horizon rules never read the device clock. Create
 * always calls `{ requireFuture: true, now: serverNow() }`. One schema, two callers, one flag.
 */
export function eventFormSchema(opts: { requireFuture: boolean; now: Date }) {
  return eventRowSchema
    .pick({ type: true, title: true, location: true })
    .extend({
      teamId: uuidSchema,
      // notes stays a non-optional string here — an uncontrolled textarea dislikes undefined —
      // and becomes null in toEventInsert, where AC7 is enforced.
      notes: z.string().trim().max(500, 'Keep notes under 500 characters.'),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
      time: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a start time.'),
    })
    .superRefine((v, ctx) => {
      // The field regexes above already flag a missing or malformed date or time; without them a
      // valid instant cannot be composed, so the horizon checks have nothing to judge.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !/^\d{2}:\d{2}$/.test(v.time)) return
      const instant = new Date(dublinLocalToUtcIso(v.date, v.time)).getTime()
      if (opts.requireFuture && instant <= opts.now.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['time'],
          message: 'Pick a time in the future.',
        })
      }
      if (instant > opts.now.getTime() + HORIZON_MS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['date'],
          message: "That's more than a year away.",
        })
      }
    })
}

export type EventFormValues = z.infer<ReturnType<typeof eventFormSchema>>

/** Form values → the insert row. Blank notes become SQL NULL, never '' (AC7). `starts_at` is the
 *  one Dublin-wall-clock-to-UTC conversion in the write path (AC3). */
export function toEventInsert(v: EventFormValues, createdBy: string): Insert<'events'> {
  const notes = v.notes.trim()
  return {
    team_id: v.teamId,
    type: v.type,
    title: v.title.trim(),
    location: v.location.trim(),
    notes: notes === '' ? null : notes,
    starts_at: dublinLocalToUtcIso(v.date, v.time),
    created_by: createdBy,
  }
}
