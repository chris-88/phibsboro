// The seed's people and rows, named by the part they play in the suite. Everything here is
// imported from supabase/seed/fixtures.ts (D15): one fixture set, no second copy. Ids are minted
// by Auth, so globalSetup provides a phone → id map (see clients.ts).
import {
  ADMIN,
  LEAVER,
  MANAGERS,
  NO_TEAM,
  PLAYERS,
  TEAM_FIRSTS,
  TEAM_SECONDS,
  eventFor,
  type Person,
} from '../../../supabase/seed/fixtures.ts'

export { SEED_PASSWORD, TEAM_FIRSTS, TEAM_SECONDS } from '../../../supabase/seed/fixtures.ts'

const player = (n: number): Person => {
  const p = PLAYERS[n - 1]
  if (!p) throw new Error(`no seeded player ${String(n)}`)
  return p
}

/**
 * The roles the suite signs in as. A signed-in session is never shared between two of them.
 *
 * - admin — Chris, `is_admin`, member of nothing (D2).
 * - managerFirsts — Declan: manages Firsts, plays for Seconds.
 * - managerSeconds — Niamh: manages Seconds, no role on Firsts.
 * - playerFirsts — Aaron: Firsts only; responded to every Firsts event, attended the past one.
 * - playerFirstsOther — Ben: Firsts only; the teammate whose rows Aaron must not touch.
 * - playerFirstsAwaiting — Ian: Firsts only; holds no response or attendance row anywhere.
 * - playerFirstsAwaitingOther — Jack: Firsts only; same, the user_id a forged insert names.
 * - playerSeconds — Liam: Seconds only.
 * - stranger — Sean: signed in, zero memberships (D37).
 * - leaver — Mark Traynor: response and attendance rows on Firsts, membership removed (D33).
 */
export const FIXTURES = {
  admin: ADMIN,
  managerFirsts: MANAGERS[0],
  managerSeconds: MANAGERS[1],
  playerFirsts: player(1),
  playerFirstsOther: player(2),
  playerFirstsAwaiting: player(9),
  playerFirstsAwaitingOther: player(10),
  playerSeconds: player(12),
  stranger: NO_TEAM,
  leaver: LEAVER,
} as const satisfies Record<string, Person>

export type Fixture = keyof typeof FIXTURES

export const FIRSTS = TEAM_FIRSTS.id
export const SECONDS = TEAM_SECONDS.id

/** Seeded events by team and slot; ids are fixed by the seed. */
export const EVENT = {
  firsts: {
    past: eventFor(FIRSTS, 'past'),
    imminent: eventFor(FIRSTS, 'imminent'),
    cancelled: eventFor(FIRSTS, 'cancelled'),
    far: eventFor(FIRSTS, 'far'),
  },
  seconds: {
    past: eventFor(SECONDS, 'past'),
    imminent: eventFor(SECONDS, 'imminent'),
    cancelled: eventFor(SECONDS, 'cancelled'),
    far: eventFor(SECONDS, 'far'),
  },
} as const

/** Squad sizes the seed fixes (S1.2): twelve a side. */
export const SQUAD_SIZE = 12

/** A uuid nothing in the database carries. */
export const UNKNOWN_UUID = '00000000-0000-4000-8000-00000000dead'

/** Throwaway accounts this suite creates: +3538999977NN, outside the seed's block and the E2E range (D58). */
export const THROWAWAY_PREFIX = '+35389999770'
export const THROWAWAY_PASSWORD = 'rls-throwaway-1234'
