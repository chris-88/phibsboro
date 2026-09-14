import type { AvailabilityResponse } from '@/features/availability/schema'

/**
 * The four counts a manager decides on (S4.3). Pure, no imports from `src/api/`, no PostgREST
 * shapes in the signature, so S7.2 tests it with plain objects and it owes nothing to the wire.
 * The screen maps its snake_case rows to `userId` at the call site.
 */

export interface SquadMember {
  readonly userId: string
}
export interface ResponseRow {
  readonly userId: string
  readonly response: AvailabilityResponse
}
export interface Counts {
  readonly available: number
  readonly unavailable: number
  readonly awaiting: number
  readonly squad: number
}

/**
 * Counts as of now. Squad is every current member (D22); a response from a user not in `squad`
 * — a leaver whose row the manager read policy still returns (D33) — is ignored and never moves
 * a number. `awaiting` is `squad − available − unavailable` by subtraction, not by iterating the
 * squad, which is what makes `available + unavailable + awaiting === squad` hold by construction
 * for every input, including an empty squad. A duplicate `userId` in `responses` cannot occur —
 * `(event_id, user_id)` is the primary key — so no de-duplication is needed and it never throws.
 */
export function deriveCounts(
  squad: readonly SquadMember[],
  responses: readonly ResponseRow[],
): Counts {
  const members = new Set(squad.map((m) => m.userId))
  let available = 0
  let unavailable = 0
  for (const r of responses) {
    if (!members.has(r.userId)) continue
    if (r.response === 'available') available += 1
    else unavailable += 1
  }
  return {
    available,
    unavailable,
    awaiting: squad.length - available - unavailable,
    squad: squad.length,
  }
}
