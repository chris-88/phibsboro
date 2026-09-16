import type { Enums } from '@/lib/db'

/**
 * The only module in the codebase that constructs a query key (A6, S1.5 AC15). One factory per
 * entity, one shape: `['<entity>', '<what>', <id>]`. The entity segment comes first so one
 * `invalidateQueries({ queryKey: eventKeys.all })` clears every event query — detail, preview,
 * upcoming, list, responses and attendance — which S3.1's optimistic `onSettled` (D48) and
 * S4.3's poll (D23) both rely on.
 *
 * A new top-level entity earns its own factory here (feedback, S12.3); a variant of an existing one
 * is a new member on that entity's object. Neither ever writes a string-literal key; lint fails it.
 */
export const eventKeys = {
  all: ['events'] as const,
  detail: (eventId: string) => ['events', 'detail', eventId] as const,
  preview: (eventId: string) => ['events', 'preview', eventId] as const,
  upcoming: (userId: string) => ['events', 'upcoming', userId] as const,
  /** The player's calendar-home month window (S10.2): keyed by user and `YYYY-MM` so a month
   *  change refetches and the response mutation's `eventKeys.all` invalidation still reaches it. */
  month: (userId: string, monthKey: string) => ['events', 'month', userId, monthKey] as const,
  /** The prefix over every month window a user holds, for the optimistic response write to patch
   *  each cached month in place (S10.2 AC6), the way it patches `upcoming`. */
  months: (userId: string) => ['events', 'month', userId] as const,
  /** The admin Home's per-event available counts for one month window (S11.2): the manage-row
   *  summary ("N available"). Under the `events` prefix so a response change invalidates it too. */
  availableCounts: (userId: string, monthKey: string) =>
    ['events', 'availableCounts', userId, monthKey] as const,
  list: (teamId: string) => ['events', 'list', teamId] as const,
  responses: (eventId: string) => ['events', 'responses', eventId] as const,
  attendance: (eventId: string) => ['events', 'attendance', eventId] as const,
  squad: (eventId: string) => ['events', 'squad', eventId] as const,
} as const

export const teamKeys = {
  all: ['teams'] as const,
  detail: (teamId: string) => ['teams', teamId] as const,
  members: (teamId: string) => ['teams', teamId, 'members'] as const,
  invite: (teamId: string, role: Enums<'member_role'>) =>
    ['teams', teamId, 'invite', role] as const,
  // The convenience manager gate for the members screen (S6.2), replaced by useCurrentUser at S2.9.
  managerGate: (teamId: string) => ['teams', teamId, 'managerGate'] as const,
  lookup: (token: string) => ['teams', 'inviteLookup', token] as const,
} as const

/**
 * `history` sits under its own prefix on purpose: a response or attendance invalidation must
 * not churn S3.5's infinite query.
 */
export const userKeys = {
  current: () => ['currentUser'] as const,
  history: (userId: string) => ['history', userId] as const,
  /** God-mode history (S11.3): all teams, so it is not user-scoped. Sits under the same `history`
   *  prefix as the player key so a response or attendance write never churns it. `'admin'` can
   *  never collide with a real userId (uuids). */
  adminHistory: () => ['history', 'admin'] as const,
  /** The admin user manager's all-users directory (S14.2). Its own prefix so a membership write
   *  invalidates only it. */
  allUsers: () => ['adminUsers'] as const,
} as const

/**
 * The admin feedback inbox (S12.3). Its own prefix, outside `events`/`history`, so nothing in the
 * app churns it and a resolve invalidates only the inbox.
 */
export const feedbackKeys = {
  all: ['feedback'] as const,
  inbox: () => ['feedback', 'inbox'] as const,
} as const

/**
 * The Stats tab reads (S17.5/S17.6). Team-scoped, its own prefix so nothing else churns them and a
 * match-stat write can invalidate performance without touching events.
 */
export const statsKeys = {
  all: ['stats'] as const,
  attendance: (teamId: string) => ['stats', 'attendance', teamId] as const,
  performance: (teamId: string) => ['stats', 'performance', teamId] as const,
} as const
