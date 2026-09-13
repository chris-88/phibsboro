import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser } from '@/api/current-user'
import { userKeys } from '@/api/queryKeys'
import { useSession } from '@/features/auth/session-context'
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
  memberships: readonly TeamMembership[]
  managedTeams: readonly TeamMembership[]
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
    retry: 3,
  })

  const data = query.data

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
    return {
      id: data.profile.id,
      name: data.profile.name,
      phone: data.profile.phone,
      isAdmin: data.profile.is_admin,
      memberships,
      managedTeams,
      isManagerOfAny: managedTeams.length > 0,
      roleForTeam,
      // Convenience only. RLS is the enforcement layer (S1.3, proved by S1.4).
      isManagerOf: (teamId: string) => roleForTeam(teamId) === 'manager' || data.profile.is_admin,
    }
  }, [data])

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
