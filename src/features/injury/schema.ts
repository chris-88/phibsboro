import { z } from 'zod'
import type { Tables } from '@/lib/db'
import type { Equal, Expect } from '@/lib/type-assert'
import { timestampSchema, uuidSchema } from '@/lib/zod'

/**
 * One row of `player_injuries` (S20.3). A row means the player is currently injured; no row means
 * fit (the event_responses "absence is a state" pattern). `expected_return` is a `date`, so it
 * arrives as a `YYYY-MM-DD` string; both it and the note are nullable (injured with no known return).
 */
export const playerInjuryRowSchema = z.object({
  user_id: uuidSchema,
  expected_return: z.string().nullable(),
  note: z.string().nullable(),
  updated_by: uuidSchema.nullable(),
  updated_at: timestampSchema,
})
export type PlayerInjuryRow = z.infer<typeof playerInjuryRowSchema>

export type InjuryParity = [Expect<Equal<PlayerInjuryRow, Tables<'player_injuries'>>>]

/**
 * The injury dialog form (S20.3), the client half of `set_injury`: an optional expected-return date
 * (from an `<input type="date">`, so `''` or `YYYY-MM-DD`) and an optional note capped at 200 — the
 * same bound as the RPC backstop. Empty strings become `null` before submit.
 */
export const injuryFormSchema = z.object({
  expectedReturn: z.string(),
  note: z.string().trim().max(200, 'Keep it under 200 characters.'),
})
export type InjuryFormValues = z.output<typeof injuryFormSchema>
