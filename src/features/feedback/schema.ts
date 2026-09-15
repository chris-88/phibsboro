import { z } from 'zod'
import type { Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

/** The three triage buckets a report can carry (W1/W2). Ordered as the form shows them. */
export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'other'] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

/** The admin triage state (W2). A user never sets this; the admin resolves through an RPC. */
export const FEEDBACK_STATUSES = ['open', 'resolved'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

/** The word each category reads as, shared by the form and the inbox so the two never drift. */
export const FEEDBACK_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: 'Bug',
  idea: 'Idea',
  other: 'Other',
}

/**
 * The context auto-captured at submit (W2): enough to reproduce a "this screen looked wrong"
 * without a back-and-forth, and no PII beyond what the user typed. Every field is optional — it is
 * a best-effort snapshot and never blocks a send.
 */
export const feedbackContextSchema = z.object({
  route: z.string().optional(),
  release: z.string().optional(),
  user_agent: z.string().optional(),
  standalone: z.boolean().optional(),
  viewport: z.string().optional(),
})
export type FeedbackContext = z.infer<typeof feedbackContextSchema>

/**
 * One feedback row as stored (S12.1). `context` is freeform `jsonb` (`Json | null`), so it is read
 * back loosely and narrowed defensively at the render site; the parity assertion below covers every
 * typed column and holds `context` aside for that reason.
 */
export const feedbackRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string(),
  context: z.unknown().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  created_at: timestampSchema,
  resolved_at: timestampSchema.nullable(),
  resolved_by: uuidSchema.nullable(),
})
export type FeedbackRow = z.infer<typeof feedbackRowSchema>

// `context` is freeform jsonb; parity is asserted on the typed columns, that one column aside.
export type Parity = [
  Expect<Equal<Omit<FeedbackRow, 'context'>, Omit<Tables<'feedback'>, 'context'>>>,
]

/** What the submit form collects (S12.2). The message is trimmed and length-bounded to match the
 *  DB check (1–2000 chars). Category defaults to `other` at the form, so it is always present. */
export const feedbackInputSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(1, 'Please type your feedback')
    .max(2000, 'Keep it under 2000 characters'),
})
export type FeedbackInput = z.infer<typeof feedbackInputSchema>

/** The admin inbox row: the stored row plus the reporter's name from the embedded profile (S12.3). */
export const feedbackInboxRowSchema = feedbackRowSchema.extend({
  reporter: z.object({ name: z.string() }).nullable(),
})
export type FeedbackInboxRow = z.infer<typeof feedbackInboxRowSchema>
