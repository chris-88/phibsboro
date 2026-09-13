import { z } from 'zod'
import type { Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { e164Schema, timestampSchema, uuidSchema } from '@/lib/zod'

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
