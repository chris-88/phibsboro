import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser, SessionInvalidError } from '@/api/current-user'
import { teamsOptions } from '@/api/teams'
import { userKeys } from '@/api/queryKeys'
import { useSession } from '@/features/auth/session-context'
import type { Team } from '@/features/teams/schema'
import type { Enums } from '@/lib/db'

type MemberRole = Enums<'member_role'>

export interface TeamMembership {
  teamId: string
  teamName: string
  role: MemberRole
  /** ISO, rendered only through formatEventTime() (D35). */
  joinedAt: string
}

export interface CurrentUser {
  id: string
  name: string
  /** E.164, own row only. Never rendered next to anyone else's. */
  phone: string
  isAdmin: boolean
  /** Storage path of the profile photo, or null for the initials fallback (W10). */
  avatarPath: string | null
  memberships: readonly TeamMembership[]
  managedTeams: readonly TeamMembership[]
  /**
   * The single source of truth for "which teams may this viewer act on" (V14, S11.1): every
   * **active** team for an admin, the caller's own active manager teams otherwise, empty for a
   * pure player. Active-only so an inactive team never enters the everyday admin reads or pickers
   * (D50); an admin reaches inactive teams through the Admin screen. Convenience only — RLS is the
   * enforcement layer (S1.3). Empty while the teams read is in flight.
   */
  administrableTeams: readonly Team[]
  isManagerOfAny: boolean
  roleForTeam: (teamId: string) => MemberRole | null
  /** role === 'manager' on that team, or a club-wide admin (D2). */
  isManagerOf: (teamId: string) => boolean
}

export type CurrentUserState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'error'; error: Error; refetch: () => void }
  | { status: 'ready'; user: CurrentUser }

/**
 * Safe to call anywhere, including on public routes. `loading` covers both the session
 * restoring and the profile query in flight; `signedOut` is no session; `error` carries a
 * `refetch`; `ready` carries the derived `CurrentUser` (AC1). No other shape.
 *
 * One query under `userKeys.current()` — S1.5's key, invalidated by S2.1, S2.4 and S6.4 by that
 * name, and emptied on sign-out (AC11), so the uuid is not in the key. The retry matters on one
 * path: a fresh signUp can return before PostgREST observes the S1.2 trigger's profiles row.
 */
export function useCurrentUser(): CurrentUserState {
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined

  const query = useQuery({
    queryKey: userKeys.current(),
    queryFn: async () => {
      if (userId === undefined) throw new Error('no session')
      return fetchCurrentUser(userId)
    },
    enabled: userId !== undefined,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    // Retry the signup race — a fresh signUp can beat PostgREST observing the S1.2 trigger's row —
    // but never a SessionInvalidError, which means the account is gone and will not reappear.
    retry: (failureCount, error) => !(error instanceof SessionInvalidError) && failureCount < 3,
    retryDelay: (attempt) => 300 * (attempt + 1),
  })

  const data = query.data

  // The active-teams read behind `administrableTeams`. Reuses S6.1's `teamsOptions()` (one query
  // key, so it de-dupes with the Home/manage `useTeams()` — no new query, per S11.1) and fires
  // only when the account needs it: an admin, or a manager of at least one team. A pure player
  // never triggers it, so the player path stays byte-for-byte unchanged. RLS scopes the rows.
  const isAdmin = data?.profile.is_admin ?? false
  const managesAny = data?.memberships.some((m) => m.role === 'manager') ?? false
  const teamsQuery = useQuery({
    ...teamsOptions(),
    enabled: userId !== undefined && (isAdmin || managesAny),
  })
  const allTeams = teamsQuery.data

  // Memoised on the query data so `roleForTeam`/`isManagerOf` keep stable identities across
  // renders that do not change the data (the spec's note under "Exposed shape").
  const user = useMemo<CurrentUser | null>(() => {
    if (!data) return null
    const memberships: readonly TeamMembership[] = data.memberships.map((m) => ({
      teamId: m.teamId,
      teamName: m.teamName,
      role: m.role,
      joinedAt: m.joinedAt,
    }))
    // For an admin, managedTeams is every team they are a member of; the all-teams picker is
    // S6.3's job, not this hook's. For everyone else it is their manager memberships.
    const managedTeams = data.profile.is_admin
      ? memberships
      : memberships.filter((m) => m.role === 'manager')
    const roleForTeam = (teamId: string): MemberRole | null =>
      memberships.find((m) => m.teamId === teamId)?.role ?? null
    // The one widened, active-only team set (V14). Already sorted active-first by `teamsOptions`,
    // and filtered to active here so a retired team stays out of every everyday admin flow (D50).
    const activeTeams = (allTeams ?? []).filter((t) => t.active)
    const administrableTeams: readonly Team[] = data.profile.is_admin
      ? activeTeams
      : activeTeams.filter((t) => roleForTeam(t.id) === 'manager')
    return {
      id: data.profile.id,
      name: data.profile.name,
      phone: data.profile.phone,
      isAdmin: data.profile.is_admin,
      avatarPath: data.profile.avatar_path,
      memberships,
      managedTeams,
      administrableTeams,
      isManagerOfAny: managedTeams.length > 0,
      roleForTeam,
      // Convenience only. RLS is the enforcement layer (S1.3, proved by S1.4).
      isManagerOf: (teamId: string) => roleForTeam(teamId) === 'manager' || data.profile.is_admin,
    }
  }, [data, allTeams])

  if (session.status === 'loading') return { status: 'loading' }
  if (session.status === 'signedOut') return { status: 'signedOut' }
  // Signed in from here: the query is enabled.
  if (query.isError) {
    const error = query.error instanceof Error ? query.error : new Error('Failed to load account')
    return { status: 'error', error, refetch: () => void query.refetch() }
  }
  if (user) return { status: 'ready', user }
  return { status: 'loading' }
}

/**
 * The signed-in user, non-null. Only callable below `RequireAuth`; anywhere else the state is
 * not `ready` and it throws a developer error the S0.6 boundary catches (AC14). It is a bug
 * signal, never a user-facing path.
 */
export function useSignedInUser(): CurrentUser {
  const state = useCurrentUser()
  if (state.status !== 'ready') {
    throw new Error(
      `useSignedInUser() must be called below RequireAuth (current status: ${state.status})`,
    )
  }
  return state.user
}
