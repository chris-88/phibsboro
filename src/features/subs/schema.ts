import { z } from 'zod'
import type { Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

/**
 * The single club-wide subs settings row (Epic 19, Y1): the amount every member owes and the admin's
 * pay link. `subs_amount` and `amount` come back as JS numbers (PostgREST renders `numeric` as a
 * number) — currency to two places, well inside the safe range. Derived from the generated types via
 * the parity assertion, never a second literal.
 */
export const clubSettingsRowSchema = z.object({
  id: z.boolean(),
  subs_amount: z.number(),
  pay_link: z.string().nullable(),
  updated_at: timestampSchema,
})
export type ClubSettingsRow = z.infer<typeof clubSettingsRowSchema>

/** One part-payment against a member's subs (Y2), recorded by an admin. */
export const subsPaymentRowSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  amount: z.number(),
  note: z.string().nullable(),
  recorded_by: uuidSchema.nullable(),
  recorded_at: timestampSchema,
})
export type SubsPaymentRow = z.infer<typeof subsPaymentRowSchema>

export type Parity = [
  Expect<Equal<ClubSettingsRow, Tables<'club_settings'>>>,
  Expect<Equal<SubsPaymentRow, Tables<'subs_payments'>>>,
]
