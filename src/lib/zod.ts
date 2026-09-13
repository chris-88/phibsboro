import { z } from 'zod'

/** Shared primitives. Entity schemas compose these; nothing else redefines them (S1.5). */

export const uuidSchema = z.string().uuid()

/** E.164 with the leading `+`, the form `profiles.phone` stores (D35). Matches the column check. */
export const e164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Not a valid phone number')

/** A `timestamptz` as PostgREST serialises it: ISO 8601 with offset. Kept as a string; the
 *  only consumer is `formatEventTime()`, which parses it. */
export const timestampSchema = z.string()
