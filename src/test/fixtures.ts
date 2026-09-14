import type { CurrentUser, TeamMembership } from '@/features/auth/use-current-user'

/**
 * Plain fixtures for the state-coverage harness (S7.1). Every row is typed against the S1.5 Zod
 * schemas at its call site (the screen's own query parses it), so a schema change breaks the
 * harness rather than letting it drift. Nothing here opens a socket; the stubbed client returns
 * these verbatim.
 */

const TEAM_ID = '00000000-0000-4000-8000-000000000001'
const TEAM_2_ID = '00000000-0000-4000-8000-000000000002'
const PLAYER_ID = '00000000-0000-4000-8000-0000000000aa'
const MANAGER_ID = '00000000-0000-4000-8000-0000000000bb'
const ADMIN_ID = '00000000-0000-4000-8000-0000000000cc'
const EVENT_ID = '00000000-0000-4000-8000-000000000101'
const PAST_EVENT_ID = '00000000-0000-4000-8000-000000000102'

export const ids = {
  team: TEAM_ID,
  team2: TEAM_2_ID,
  player: PLAYER_ID,
  manager: MANAGER_ID,
  admin: ADMIN_ID,
  event: EVENT_ID,
  pastEvent: PAST_EVENT_ID,
} as const

// A long-ago join, so filterHistory keeps this player's past events.
const JOINED_AT = '2020-01-01T00:00:00+00:00'
// Far future / far past, so a screen's own serverNow() cut-off never hides a fixture. The stub
// ignores the query's own .gte/.lt filters, so these only have to satisfy the schemas and the
// pure client-side pickers (pickNextEvent, filterHistory).
const FUTURE = '2099-06-13T18:30:00+00:00'
const PAST = '2020-06-13T18:30:00+00:00'

function membership(over: Partial<TeamMembership> = {}): TeamMembership {
  return { teamId: TEAM_ID, teamName: 'Firsts', role: 'player', joinedAt: JOINED_AT, ...over }
}

/** The three fake accounts the harness signs the router in as. Convenience only — RLS is the real
 *  boundary; here the mocked `useCurrentUser` simply hands each screen a resolved user so the
 *  route's own data query is what the scenario exercises. */
export function fakeUser(role: 'player' | 'manager' | 'admin'): CurrentUser {
  const memberships: TeamMembership[] =
    role === 'player' ? [membership()] : [membership({ role: 'manager' })]
  const isAdmin = role === 'admin'
  const managed = isAdmin ? memberships : memberships.filter((m) => m.role === 'manager')
  const id = role === 'player' ? PLAYER_ID : role === 'manager' ? MANAGER_ID : ADMIN_ID
  const roleForTeam = (teamId: string): TeamMembership['role'] | null =>
    memberships.find((m) => m.teamId === teamId)?.role ?? null
  return {
    id,
    name: role === 'player' ? 'Pat Player' : role === 'manager' ? 'Mel Manager' : 'Ada Admin',
    phone: '+353871234567',
    isAdmin,
    memberships,
    managedTeams: managed,
    isManagerOfAny: managed.length > 0,
    roleForTeam,
    isManagerOf: (teamId: string) => roleForTeam(teamId) === 'manager' || isAdmin,
  }
}

// —— Row fixtures, keyed by the source the stub resolves them from ————————————————

/** upcomingEventRowSchema — the home card read. */
export const upcomingEventRows = [
  {
    id: EVENT_ID,
    team_id: TEAM_ID,
    type: 'match',
    title: 'Firsts v Shelbourne',
    location: 'Tolka Park',
    starts_at: FUTURE,
    status: 'scheduled',
    teams: { name: 'Firsts' },
    event_responses: [],
  },
]

/** eventWithResponseSchema — the single-event member read (.maybeSingle). */
export const eventDetailRow = {
  id: EVENT_ID,
  team_id: TEAM_ID,
  type: 'match',
  title: 'Firsts v Shelbourne',
  location: 'Tolka Park',
  notes: 'Meet at 6.',
  starts_at: FUTURE,
  status: 'scheduled',
  teams: { name: 'Firsts' },
  event_responses: [],
}

/** historyRowSchema — the past-events read; recorded, so filterHistory always keeps it. */
export const historyEventRows = [
  {
    id: PAST_EVENT_ID,
    team_id: TEAM_ID,
    type: 'training',
    title: 'Tuesday training',
    starts_at: PAST,
    status: 'scheduled',
    attendance: [{ attended: true }],
  },
]

/** eventRowSchema — the full-row manager list read (select *). */
export const teamEventRows = [
  {
    id: EVENT_ID,
    team_id: TEAM_ID,
    type: 'match',
    title: 'Firsts v Shelbourne',
    location: 'Tolka Park',
    notes: null,
    starts_at: FUTURE,
    status: 'scheduled',
    series_id: null,
    created_by: MANAGER_ID,
    created_at: PAST,
    updated_at: PAST,
  },
]

/** teamRowSchema — the teams read behind /admin and every manage header. */
export const teamRows = [
  { id: TEAM_ID, name: 'Firsts', active: true, created_at: PAST },
  { id: TEAM_2_ID, name: 'Seconds', active: false, created_at: PAST },
]

/** memberDirectoryRowSchema — team_member_directory RPC. */
export const memberRows = [
  { user_id: MANAGER_ID, name: 'Mel Manager', role: 'manager', joined_at: JOINED_AT, phone: null },
  { user_id: PLAYER_ID, name: 'Pat Player', role: 'player', joined_at: JOINED_AT, phone: null },
]

/** eventResponseRowSchema — the manager responses read. */
export const responseRows = [
  { event_id: EVENT_ID, user_id: PLAYER_ID, response: 'available', updated_at: PAST },
]

/** attendance pick — user_id, attended. */
export const attendanceRows = [{ user_id: PLAYER_ID, attended: true }]

/** teamInviteLookupSchema — lookup_team_invite RPC (join and register). */
export const inviteLookupRows = [{ team_id: TEAM_ID, team_name: 'Firsts', role: 'player' }]

/** teamInviteViewSchema — get_team_invite RPC (join-link panel). Left empty so the panel shows
 *  its own empty state; never asserted by the member-screen cases. */
export const teamInviteViewRows: unknown[] = []
