import { z } from 'zod'
import { availabilityResponseSchema } from '@/features/availability/schema'
import type { Enums, FnRow, Insert, Tables, Update } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { dublinLocalToUtcIso } from '@/lib/time'
import { timestampSchema, uuidSchema } from '@/lib/zod'

export const eventTypeSchema = z.enum(['training', 'match', 'social'])
export const eventStatusSchema = z.enum(['scheduled', 'cancelled'])
export const homeAwaySchema = z.enum(['home', 'away'])
/** The kit a team wears for a match (W7). `sky` is stored; the UI reads "Light Blue". */
export const jerseySchema = z.enum(['black', 'sky', 'white'])

export type EventType = z.infer<typeof eventTypeSchema>
export type EventStatus = z.infer<typeof eventStatusSchema>
export type HomeAway = z.infer<typeof homeAwaySchema>
export type Jersey = z.infer<typeof jerseySchema>

/** The one place a jersey value becomes words — form, detail and WhatsApp share read it here so
 *  the three never drift (W7). */
export const JERSEY_LABEL: Record<Jersey, string> = {
  black: 'Black',
  sky: 'Light Blue',
  white: 'White',
}

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
  // Match only (V3, S8.2), both null for training and social. `opponent` feeds the derived title;
  // `home_away` orders it and labels the event. No DB length check on `opponent`, so the row bound
  // here is generous — the form caps what it writes, the stored `title` carries the real 80 limit.
  opponent: z.string().max(80).nullable(),
  home_away: homeAwaySchema.nullable(),
  // Match only (W7, S15.1): the kit the team wears. Null for training/social and a match with none
  // chosen. The DB check enforces match-only, mirroring opponent/home_away.
  jersey: jerseySchema.nullable(),
  // Match only (V4, S8.3): the arrival time, earlier than `starts_at` (kick-off). Null for
  // training and social, and for a match with no separate meet time. The DB check enforces the
  // ordering; `starts_at` stays kick-off and keeps driving the S3.4 respond-until rule.
  meet_at: timestampSchema.nullable(),
  starts_at: timestampSchema,
  status: eventStatusSchema,
  series_id: uuidSchema.nullable(),
  created_by: uuidSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
})
export type EventRow = z.infer<typeof eventRowSchema>

/**
 * The columns the S4.2 action components (the overflow menu and its edit/cancel/delete dialogs)
 * actually read. Narrowed from `EventRow` so those components can be mounted on S4.3's manager
 * event view, which reuses S3.3's single-event read — a projection that omits the four audit
 * columns (`series_id`, `created_by`, `created_at`, `updated_at`) none of them touch. A full
 * `EventRow` is assignable to it, so the `/manage` list keeps passing its rows unchanged.
 */
export type EventActionData = Pick<
  EventRow,
  | 'id'
  | 'team_id'
  | 'type'
  | 'title'
  | 'location'
  | 'notes'
  | 'opponent'
  | 'home_away'
  | 'jersey'
  | 'meet_at'
  | 'starts_at'
  | 'status'
>

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
    opponent: true,
    home_away: true,
    jersey: true,
    meet_at: true,
    starts_at: true,
    status: true,
  })
  .extend({
    teams: z.object({ name: z.string() }),
    event_responses: z.array(z.object({ response: availabilityResponseSchema })).max(1),
  })
export type EventWithResponseRow = z.infer<typeof eventWithResponseSchema>

/**
 * One row of the upcoming-events read behind the home card (S3.1) and the S3.2 list. The same
 * shape as the detail read minus `notes` — the card never shows notes — with the team name from
 * an inner join and the caller's own response embedded. As with the detail read, the embed is
 * filtered to `auth.uid()` in the query, so `.max(1)` fails loudly in a test if that filter is
 * ever dropped and a manager's read returns the whole squad (D22, D32).
 */
export const upcomingEventRowSchema = eventRowSchema
  .pick({
    id: true,
    team_id: true,
    type: true,
    title: true,
    location: true,
    starts_at: true,
    status: true,
  })
  .extend({
    teams: z.object({ name: z.string() }),
    event_responses: z.array(z.object({ response: availabilityResponseSchema })).max(1),
  })
export type UpcomingEventRow = z.infer<typeof upcomingEventRowSchema>

/** What `get_event_preview` returns to anyone, signed in or not (D7). Never `notes`. */
export const eventPreviewSchema = eventRowSchema
  .pick({ team_id: true, type: true, title: true, location: true, starts_at: true, status: true })
  .extend({ team_name: z.string() })
export type EventPreview = z.infer<typeof eventPreviewSchema>

/**
 * The `event_squad` row, column for column (data-model-v1.1.0, V6/S9.1). One picked player: their
 * shirt number 1–20, whether they wear the armband, and who recorded it. Written only through the
 * S9.1 RPCs and read by `useEventSquad` (src/api/squad.ts); the picker UI is S9.2. `shirt_number`
 * carries the 1–20 bound the DB check enforces, so a bad value fails at the boundary parse.
 */
export const squadRowSchema = z.object({
  event_id: uuidSchema,
  user_id: uuidSchema,
  shirt_number: z.number().int().min(1).max(20),
  is_captain: z.boolean(),
  recorded_by: uuidSchema,
  updated_at: timestampSchema,
})
export type SquadRow = z.infer<typeof squadRowSchema>

/** Compile-time parity with the generated types (D24, S1.5 AC2, AC3). */
export type Parity = [
  Expect<Equal<EventType, Enums<'event_type'>>>,
  Expect<Equal<EventStatus, Enums<'event_status'>>>,
  Expect<Equal<HomeAway, Enums<'home_away'>>>,
  Expect<Equal<Jersey, Enums<'jersey'>>>,
  Expect<Equal<EventRow, Tables<'events'>>>,
  Expect<Equal<SquadRow, Tables<'event_squad'>>>,
  Expect<Equal<EventPreview, FnRow<'get_event_preview'>>>,
]

// —— The create/edit form (S4.1) ————————————————————————————————————————————
// Derived from eventRowSchema, never written as a second literal (S1.5 AC18): the four shared
// columns are picked off the row, and `date` + `time` replace the composed `starts_at`. S4.6
// adds its series schema to this same file.

/** True when switching type should overwrite the title: only when the field is empty or still
 *  holds another type's default label. A manager who typed "Kilbarrack away" keeps it (AC2). */
export function shouldRewriteTitle(current: string, nextType: EventType): boolean {
  const trimmed = current.trim()
  if (trimmed === '') return true
  const defaults = Object.values(DEFAULT_TITLES)
  return defaults.includes(trimmed) && trimmed !== DEFAULT_TITLES[nextType]
}

/** The default title per type. "Training" for training, "Social" for social (AC2, S8.1). */
export const DEFAULT_TITLES: Record<EventType, string> = {
  training: 'Training',
  match: 'Match',
  social: 'Social',
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
      // Match only (S8.2). Always present in the form values — the fields are simply hidden for
      // training and social — and reconciled to null in toEventInsert/Update for a non-match. The
      // title is derived from these, not typed, so it is not a user field for a match (V3, AC2).
      opponent: z.string().trim().max(80, 'Keep the opponent name short.'),
      homeAway: homeAwaySchema,
      // Match only (W7, S15.1): the kit, optional even on a match. Null = "Not set" and stores
      // jersey null; hidden and reconciled to null for training/social in toEventInsert/Update.
      jersey: jerseySchema.nullable(),
      // Match only (V4, S8.3): the arrival time, on the same date as kick-off, earlier than it.
      // Always present in the form values — hidden for training and social — and optional even on
      // a match; empty means no separate meet time and stores meet_at null.
      meetTime: z.string(),
    })
    .superRefine((v, ctx) => {
      // Opponent is required for a match and forbidden otherwise (V3, AC3). The generated title
      // carries its own 1–80 bound through the picked `title` field, so an over-long match title
      // is already blocked; here we only guard the raw opponent.
      if (v.type === 'match') {
        if (v.opponent.trim() === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['opponent'],
            message: 'Enter the opponent.',
          })
        }
      } else if (v.opponent.trim() !== '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['opponent'],
          message: 'Opponent is only for matches.',
        })
      }
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
      // Meet is match-only and optional (V4, S8.3). When a match carries one it must be a valid
      // time and strictly before kick-off; the DB check is the backstop (AC3). Composed against
      // the same date as kick-off, in Dublin wall time, so the ordering is compared on real
      // instants and not two naive strings.
      if (v.type === 'match' && v.meetTime !== '') {
        if (!/^\d{2}:\d{2}$/.test(v.meetTime)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['meetTime'],
            message: 'Pick a meet time.',
          })
        } else {
          const meet = new Date(dublinLocalToUtcIso(v.date, v.meetTime)).getTime()
          if (meet >= instant) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['meetTime'],
              message: 'Meet must be before kick-off.',
            })
          }
        }
      }
    })
}

export type EventFormValues = z.infer<ReturnType<typeof eventFormSchema>>

/** Form values → the insert row. Blank notes become SQL NULL, never '' (AC7). `starts_at` is the
 *  one Dublin-wall-clock-to-UTC conversion in the write path (AC3). */
export function toEventInsert(v: EventFormValues, createdBy: string): Insert<'events'> {
  const notes = v.notes.trim()
  const isMatch = v.type === 'match'
  return {
    team_id: v.teamId,
    type: v.type,
    // For a match the title is the derived value the form kept in sync; for training/social it is
    // the typed/defaulted title (V3, AC6). The raw match fields are null off a match, matching the
    // DB check.
    title: v.title.trim(),
    location: v.location.trim(),
    notes: notes === '' ? null : notes,
    opponent: isMatch ? v.opponent.trim() : null,
    home_away: isMatch ? v.homeAway : null,
    jersey: isMatch ? v.jersey : null,
    // Composed against the same date as kick-off; null off a match or when no meet time is set,
    // matching the DB checks (V4, AC3).
    meet_at: isMatch && v.meetTime !== '' ? dublinLocalToUtcIso(v.date, v.meetTime) : null,
    starts_at: dublinLocalToUtcIso(v.date, v.time),
    created_by: createdBy,
  }
}

/**
 * Form values → the update payload (S4.2). Only the six editable columns are written:
 * `team_id`, `created_by`, `created_at` and `series_id` are never in the payload — omitting
 * `series_id` is what makes "editing one occurrence leaves the others untouched" true by
 * construction (D30). `updated_at` is the trigger's job. Blank notes become NULL, never '' (AC7).
 */
export function toEventUpdate(v: EventFormValues): Update<'events'> {
  const notes = v.notes.trim()
  const isMatch = v.type === 'match'
  return {
    type: v.type,
    title: v.title.trim(),
    location: v.location.trim(),
    notes: notes === '' ? null : notes,
    // Switching a match to another type clears the raw fields (and the DB check would refuse them
    // otherwise); editing a match's opponent or home/away re-stores them and the regenerated title
    // (AC5).
    opponent: isMatch ? v.opponent.trim() : null,
    home_away: isMatch ? v.homeAway : null,
    jersey: isMatch ? v.jersey : null,
    meet_at: isMatch && v.meetTime !== '' ? dublinLocalToUtcIso(v.date, v.meetTime) : null,
    starts_at: dublinLocalToUtcIso(v.date, v.time),
  }
}

// —— The recurring-training generator (S4.6) ————————————————————————————————————
// A second form off the same file (D34: a mode of /manage/event/new, not a new screen). Like
// eventFormSchema it is a factory taking `now`, so the clock is injected — serverNow() in the app,
// a fixed instant in the unit tests — and the schema never reads the device clock. `title` and
// `location` are picked off eventRowSchema, never re-literalled (S1.5 AC18); `weeks` carries D30's
// cap of 16, mirrored again in generate_training_series. `firstStartsAt` is the one
// Dublin-wall-clock-to-UTC value the form composes through dublinLocalToUtcIso before submit.

export function trainingSeriesSchema(opts: { now: Date }) {
  return eventRowSchema
    .pick({ title: true, location: true })
    .extend({
      teamId: uuidSchema,
      firstStartsAt: z.string().datetime({ offset: true }),
      weeks: z
        .number()
        .int('Pick a whole number of weeks.')
        .min(1, 'Pick at least one week.')
        .max(16, 'Pick 16 weeks or fewer.'),
    })
    .refine((v) => Date.parse(v.firstStartsAt) > opts.now.getTime(), {
      path: ['firstStartsAt'],
      message: 'Pick a date in the future.',
    })
}
export type TrainingSeriesInput = z.infer<ReturnType<typeof trainingSeriesSchema>>
