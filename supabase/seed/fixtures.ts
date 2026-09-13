// Seed fixtures — not secrets (D38). Local, CI and the pre-go-live hosted project only (D63).
//
// Every constant the seed writes lives here so two seeds of the same commit produce the same
// teams, events, names, numbers and roles (S1.2 AC23). Two things are deliberately not fixed:
// user ids, which Auth mints, so every lookup is by phone; and starts_at, which is an offset
// from the single clock read in seed.ts so "past" and "imminent" stay true whenever it runs.
//
// Numbers: Irish mobile shape, +353 89 9999 NNN. Every number here starts +3538999; the
// +3538990 range is reserved for E2E registration runs (D58) and the seed never issues it.
// Password: SEED_PASSWORD, shared by all 25 accounts. Sign in with phone + this password.

export const SEED_PASSWORD = 'phibsboro-seed-1234'

/** D58 — reserved for Playwright registration runs. Nothing below may start with it. */
export const E2E_RESERVED_PREFIX = '+3538990'

export interface Person {
  readonly phone: string
  readonly name: string
}

export const ADMIN: Person = { phone: '+353899999001', name: 'Chris Quinn' } // Q6

export const MANAGERS = [
  { phone: '+353899999002', name: 'Declan Ward' }, // manages Firsts, plays for Seconds
  { phone: '+353899999003', name: 'Niamh Doyle' }, // manages Seconds
] as const satisfies readonly Person[]

export const PLAYERS = [
  { phone: '+353899999010', name: 'Aaron Byrne' },
  { phone: '+353899999011', name: 'Ben Murphy' },
  { phone: '+353899999012', name: 'Cian Kelly' },
  { phone: '+353899999013', name: 'Dara Walsh' },
  { phone: '+353899999014', name: 'Eoin Ryan' },
  { phone: '+353899999015', name: 'Finn Nolan' },
  { phone: '+353899999016', name: 'Gavin Brennan' },
  { phone: '+353899999017', name: 'Hugh Farrell' },
  { phone: '+353899999018', name: 'Ian Keogh' },
  { phone: '+353899999019', name: 'Jack Dunne' },
  { phone: '+353899999020', name: 'Karl Reilly' }, // plays for both teams
  { phone: '+353899999021', name: 'Liam Carroll' },
  { phone: '+353899999022', name: 'Mark Hogan' },
  { phone: '+353899999023', name: 'Neil Cullen' },
  { phone: '+353899999024', name: 'Oisin Maguire' },
  { phone: '+353899999025', name: 'Paul Sheridan' },
  { phone: '+353899999026', name: 'Rory Fitzgerald' },
  { phone: '+353899999027', name: 'Sam Nugent' },
  { phone: '+353899999028', name: 'Tom Lynch' },
  { phone: '+353899999029', name: 'Will Moran' },
] as const satisfies readonly Person[]

/** Signed in, member of nothing: the fourth S1.4 role (D37). */
export const NO_TEAM: Person = { phone: '+353899999040', name: 'Sean Kelly' }

/** Held a response and an attendance row on Firsts, then left (D33). */
export const LEAVER: Person = { phone: '+353899999041', name: 'Mark Traynor' }

/** All 25 accounts, in creation order. */
export const EVERYONE: readonly Person[] = [ADMIN, ...MANAGERS, ...PLAYERS, NO_TEAM, LEAVER]

export const TEAM_FIRSTS = { id: '00000000-0000-4000-8000-000000000001', name: 'Firsts' } as const
export const TEAM_SECONDS = { id: '00000000-0000-4000-8000-000000000002', name: 'Seconds' } as const
export const TEAMS = [TEAM_FIRSTS, TEAM_SECONDS] as const

type Role = 'player' | 'manager'
export interface Membership {
  readonly teamId: string
  readonly phone: string
  readonly role: Role
}

const firstsPlayers = PLAYERS.slice(0, 11) // players 1–10 plus Karl Reilly
const secondsPlayers = PLAYERS.slice(10) // Karl Reilly plus players 12–20

// Squad layout, fixed so S4.3's counts have a known answer. Twelve a side. Declan manages Firsts
// and plays for Seconds (AC18); Karl Reilly plays for both. The admin holds no membership: admin
// is a club-wide flag, not a role on a team (D2).
export const MEMBERSHIPS: readonly Membership[] = [
  { teamId: TEAM_FIRSTS.id, phone: MANAGERS[0].phone, role: 'manager' },
  ...firstsPlayers.map((p) => ({
    teamId: TEAM_FIRSTS.id,
    phone: p.phone,
    role: 'player' as const,
  })),
  { teamId: TEAM_SECONDS.id, phone: MANAGERS[1].phone, role: 'manager' },
  { teamId: TEAM_SECONDS.id, phone: MANAGERS[0].phone, role: 'player' },
  ...secondsPlayers.map((p) => ({
    teamId: TEAM_SECONDS.id,
    phone: p.phone,
    role: 'player' as const,
  })),
]

export interface EventFixture {
  readonly id: string
  readonly teamId: string
  readonly type: 'training' | 'match'
  readonly title: string
  readonly location: string
  readonly notes: string | null
  /** Hours from the captured `now`. Negative is past. */
  readonly offsetHours: number
  readonly status: 'scheduled' | 'cancelled'
}

// Per team: one past, one imminent (inside 48 hours), one cancelled, one more than seven days
// out — the four fixtures D12's cut-off tests need (AC19).
const teamEvents = (team: (typeof TEAMS)[number], n: string): readonly EventFixture[] => [
  {
    id: `00000000-0000-4000-8000-000000000${n}01`,
    teamId: team.id,
    type: 'training',
    title: 'Training',
    location: 'Dalymount Park',
    notes: null,
    offsetHours: -7 * 24,
    status: 'scheduled',
  },
  {
    id: `00000000-0000-4000-8000-000000000${n}02`,
    teamId: team.id,
    type: 'training',
    title: 'Training',
    location: 'Dalymount Park',
    notes: 'Bring both kits.',
    offsetHours: 26,
    status: 'scheduled',
  },
  {
    id: `00000000-0000-4000-8000-000000000${n}03`,
    teamId: team.id,
    type: 'match',
    title: `${team.name} v Bohemians`,
    location: 'Phoenix Park, pitch 9',
    notes: null,
    offsetHours: 3 * 24,
    status: 'cancelled',
  },
  {
    id: `00000000-0000-4000-8000-000000000${n}04`,
    teamId: team.id,
    type: 'match',
    title: `${team.name} v Shelbourne`,
    location: 'Tolka Park',
    notes: 'Meet at the gate 45 minutes before.',
    offsetHours: 10 * 24,
    status: 'scheduled',
  },
]

export const EVENTS: readonly EventFixture[] = [
  ...teamEvents(TEAM_FIRSTS, '1'),
  ...teamEvents(TEAM_SECONDS, '2'),
]

/** Looks up the one seeded event for a team by its position in the four above. */
export const eventFor = (teamId: string, slot: 'past' | 'imminent' | 'cancelled' | 'far') => {
  const index = { past: 0, imminent: 1, cancelled: 2, far: 3 }[slot]
  const event = EVENTS.filter((e) => e.teamId === teamId)[index]
  if (!event) throw new Error(`no ${slot} event for team ${teamId}`)
  return event
}

export interface ResponseFixture {
  readonly eventId: string
  readonly phone: string
  readonly response: 'available' | 'unavailable'
}

const p = (i: number) => {
  const player = PLAYERS[i - 1]
  if (!player) throw new Error(`no player ${String(i)}`)
  return player.phone
}
const respond = (
  eventId: string,
  available: readonly string[],
  unavailable: readonly string[],
): ResponseFixture[] => [
  ...available.map((phone) => ({ eventId, phone, response: 'available' as const })),
  ...unavailable.map((phone) => ({ eventId, phone, response: 'unavailable' as const })),
]

// Mixed on purpose (AC20). On each imminent event three squad members have no row at all, so
// awaiting is exercised as an absent row: Firsts 6 available, 3 unavailable, 3 awaiting
// (Ian, Jack, Karl); Seconds 6, 3, 3 (Sam, Tom, Will). The leaver's row on Firsts' imminent
// event is the D22 "excluded from counts" fixture.
export const RESPONSES: readonly ResponseFixture[] = [
  ...respond(
    eventFor(TEAM_FIRSTS.id, 'imminent').id,
    [MANAGERS[0].phone, p(1), p(2), p(3), p(4), p(5)],
    [p(6), p(7), p(8)],
  ),
  { eventId: eventFor(TEAM_FIRSTS.id, 'imminent').id, phone: LEAVER.phone, response: 'available' },
  ...respond(
    eventFor(TEAM_SECONDS.id, 'imminent').id,
    [MANAGERS[1].phone, p(11), p(12), p(13), p(14), p(15)],
    [MANAGERS[0].phone, p(16), p(17)],
  ),
  ...respond(eventFor(TEAM_FIRSTS.id, 'far').id, [p(1), p(2)], [p(3)]),
  ...respond(eventFor(TEAM_SECONDS.id, 'far').id, [p(12)], [p(13), p(14)]),
  ...respond(eventFor(TEAM_FIRSTS.id, 'cancelled').id, [p(1)], []),
  ...respond(
    eventFor(TEAM_FIRSTS.id, 'past').id,
    [MANAGERS[0].phone, p(1), p(2), p(3), p(4), p(5), p(6), p(7)],
    [p(8)],
  ),
  ...respond(
    eventFor(TEAM_SECONDS.id, 'past').id,
    [MANAGERS[1].phone, p(11), p(12), p(13), p(14), p(15), p(16), p(17)],
    [p(18)],
  ),
]

export interface AttendanceFixture {
  readonly eventId: string
  readonly phone: string
  readonly attended: boolean
  /** The managing manager's phone (AC21). */
  readonly recordedBy: string
}

const attend = (
  eventId: string,
  recordedBy: string,
  attended: readonly string[],
  absent: readonly string[],
): AttendanceFixture[] => [
  ...attended.map((phone) => ({ eventId, phone, attended: true, recordedBy })),
  ...absent.map((phone) => ({ eventId, phone, attended: false, recordedBy })),
]

// Past events only: some recorded, some not, at least one `false` (AC21). The leaver's row on
// Firsts' past event is the D33 retention fixture.
export const ATTENDANCE: readonly AttendanceFixture[] = [
  ...attend(
    eventFor(TEAM_FIRSTS.id, 'past').id,
    MANAGERS[0].phone,
    [MANAGERS[0].phone, p(1), p(2), p(3), p(4), p(5), p(6), LEAVER.phone],
    [p(7)],
  ),
  ...attend(
    eventFor(TEAM_SECONDS.id, 'past').id,
    MANAGERS[1].phone,
    [MANAGERS[1].phone, p(11), p(12), p(13), p(14), p(15), p(16)],
    [p(17)],
  ),
]

/** The leaver's membership, inserted and then deleted so the rows above are orphaned (D33). */
export const LEAVER_MEMBERSHIP: Membership = {
  teamId: TEAM_FIRSTS.id,
  phone: LEAVER.phone,
  role: 'player',
}
