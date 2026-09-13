import type { Enums } from '@/lib/db'

/**
 * The only module in the codebase that constructs a query key (A6, S1.5 AC15). Three factories,
 * one shape: `['<entity>', '<what>', <id>]`. The entity segment comes first so one
 * `invalidateQueries({ queryKey: eventKeys.all })` clears every event query — detail, preview,
 * upcoming, list, responses and attendance — which S3.1's optimistic `onSettled` (D48) and
 * S4.3's poll (D23) both rely on.
 *
 * Later stories add members to these three objects. They do not declare a fourth factory and
 * they do not write a string-literal key; lint fails both.
 */
export const eventKeys = {
  all: ['events'] as const,
  detail: (eventId: string) => ['events', 'detail', eventId] as const,
  preview: (eventId: string) => ['events', 'preview', eventId] as const,
  upcoming: (userId: string) => ['events', 'upcoming', userId] as const,
  list: (teamId: string) => ['events', 'list', teamId] as const,
  responses: (eventId: string) => ['events', 'responses', eventId] as const,
  attendance: (eventId: string) => ['events', 'attendance', eventId] as const,
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
} as const
