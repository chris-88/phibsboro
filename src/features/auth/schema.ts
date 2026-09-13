import { z } from 'zod'
import type { Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { toE164 } from '@/lib/phone'
import { e164Schema, timestampSchema, uuidSchema } from '@/lib/zod'

/**
 * The one phone field, shared by registration and sign-in, so a number typed one way at signup
 * signs in when typed the other way (D35). It transforms through the single `toE164` normaliser
 * (never a second copy): the field's output is E.164, the input is whatever the player typed.
 * A landline, a short number or free text `toE164` cannot make sense of is refused inline,
 * before any network call (AC4).
 */
export const phoneField = z.string().transform((raw, ctx) => {
  const e164 = toE164(raw)
  if (e164 === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That doesn't look like a mobile number" })
    return z.NEVER
  }
  return e164
})

/**
 * Registration is three fields and one button (CLAUDE.md §Epic 2). Nothing here widens it. The
 * name is trimmed and bounded to the `profiles.name` column check; the password is length-only,
 * min 8, no composition rules (AC6). The schema transforms, so input and output types differ —
 * the form declares both (RegisterInput in, RegisterValues out).
 */
export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Your name').max(80),
  phone: phoneField,
  password: z.string().min(8, 'At least 8 characters'),
})
export type RegisterInput = z.input<typeof registerSchema>
export type RegisterValues = z.output<typeof registerSchema>

/**
 * Sign in is the same two fields as the bottom of registration, through the same `phoneField`
 * (D35), so a number typed `+353 87` at signup signs in typed `087` (S2.2 AC2). There is no
 * 8-character floor here on purpose: sign-in does not re-validate an old account, and enforcing
 * a length would be one more way to leak that an account exists (S2.2 schema notes). `min(1)`
 * only, so the submit button can gate on both fields being non-empty.
 */
export const signInSchema = z.object({
  phone: phoneField,
  password: z.string().min(1, 'Password'),
})
export type SignInInput = z.input<typeof signInSchema>
export type SignInValues = z.output<typeof signInSchema>

/** `id` is the `auth.users` id (D4). A client reads only its own row (D8). */
export const profileRowSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(80),
  phone: e164Schema,
  is_admin: z.boolean(),
  created_at: timestampSchema,
})
export type ProfileRow = z.infer<typeof profileRowSchema>

/** Not selectable by any client (S1.3); issued and redeemed through RPCs. Kept for parity (AC2). */
export const resetTokenSchema = z.object({
  id: uuidSchema,
  user_id: uuidSchema,
  team_id: uuidSchema,
  token: z.string(),
  issued_at: timestampSchema,
  expires_at: timestampSchema,
  used_at: timestampSchema.nullable(),
  revoked_at: timestampSchema.nullable(),
  created_by: uuidSchema.nullable(),
})
export type ResetToken = z.infer<typeof resetTokenSchema>

export type Parity = [
  Expect<Equal<ProfileRow, Tables<'profiles'>>>,
  Expect<Equal<ResetToken, Tables<'reset_tokens'>>>,
]
