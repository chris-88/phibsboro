import type { Enums } from '@/lib/db'

/**
 * The pure join-and-sort behind S4.4's response list. No imports from `src/api/`, no PostgREST
 * shapes and no Supabase client in the signature, so its Vitest cases run with no database — the
 * same rule `deriveCounts()` follows in `src/lib/counts.ts`. The screen maps its snake_case rows
 * to `userId` at the call site, so the two derivations take the same two arrays in the same shapes.
 */

type Role = Enums<'member_role'>
type Response = Enums<'availability_response'>

export interface RosterMember {
  readonly userId: string
  readonly name: string
  readonly role: Role
}
export interface RosterResponse {
  readonly userId: string
  readonly response: Response
}
export interface RosterAttendance {
  readonly userId: string
  readonly attended: boolean
}

export interface RosterRow {
  readonly userId: string
  readonly name: string
  readonly role: Role
  /** null means awaiting — absence of an `event_responses` row, never a stored value (D25). */
  readonly response: Response | null
  /** null means not recorded — absence of an `attendance` row (D25). */
  readonly attended: boolean | null
}

const collator = new Intl.Collator('en-IE', { sensitivity: 'base' })

/** Awaiting first, then available, then unavailable (AC3). */
function rank(response: Response | null): number {
  if (response === null) return 0
  return response === 'available' ? 1 : 2
}

/**
 * One row per current member (AC1). Responses and attendance are looked up by `userId` through a
 * `Map`, so a row whose `userId` matches no member — a leaver whose historic rows the manager read
 * policy still returns (D22, D33) — is dropped and moves nothing. Sorted awaiting → available →
 * unavailable, then by name case-insensitively, then `userId` ascending, so the order is identical
 * on every render and does not shuffle on a poll (AC3). Never sorts in place: the inputs are
 * `readonly` and come straight from the query cache.
 */
export function buildRoster(
  members: readonly RosterMember[],
  responses: readonly RosterResponse[],
  attendance: readonly RosterAttendance[],
): RosterRow[] {
  const responseByUser = new Map(responses.map((r) => [r.userId, r.response]))
  const attendedByUser = new Map(attendance.map((a) => [a.userId, a.attended]))

  const rows: RosterRow[] = members.map((m) => ({
    userId: m.userId,
    name: m.name,
    role: m.role,
    response: responseByUser.get(m.userId) ?? null,
    attended: attendedByUser.get(m.userId) ?? null,
  }))

  return rows.sort((a, b) => {
    const byRank = rank(a.response) - rank(b.response)
    if (byRank !== 0) return byRank
    const byName = collator.compare(a.name, b.name)
    if (byName !== 0) return byName
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
  })
}

/**
 * The `userId`s the S4.5 bulk action targets: current members whose response is `available`. The
 * "and has no attendance row yet" half of AC5 is left to the write's `on conflict do nothing`, not
 * filtered here, so an already-marked `Absent` player survives a re-run. Empty for an all-awaiting
 * or all-unavailable squad, which is what disables the bulk button (AC6).
 */
export function availableForAttendance(rows: readonly RosterRow[]): string[] {
  return rows.filter((r) => r.response === 'available').map((r) => r.userId)
}
