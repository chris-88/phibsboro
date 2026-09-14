import { useTeams } from '@/api/teams'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { byActiveThenName, type Team } from '@/features/teams/schema'

export interface ManagedTeams {
  /** Active first, then case-insensitively by name (D8, S6.1 AC8). */
  teams: Team[]
  isLoading: boolean
  isError: boolean
}

/**
 * The teams the caller may manage, for the S6.3 picker. Reads S6.1's `useTeams()` — RLS already
 * limits the rows (D8) — and filters by role:
 *
 * - an admin manages every returned team, membership or not (D2), so the list is the full
 *   `useTeams()` result. This is the fix S6.3 exists for: `useCurrentUser().managedTeams` is a
 *   member's manager memberships and is empty for a membership-less admin, so it cannot be the
 *   source here;
 * - everyone else manages the teams where their own membership role is `manager`. A manager who
 *   is a *player* on a second team must not see it, so the filter is on role, not membership, and
 *   deliberately not `isManagerOf(teamId)` (true for an admin everywhere).
 *
 * Ordering is owned here so every consumer of the list sees one order.
 */
export function useManagedTeams(): ManagedTeams {
  const account = useCurrentUser()
  const teams = useTeams()

  if (account.status === 'loading' || teams.isPending) {
    return { teams: [], isLoading: true, isError: false }
  }
  if (account.status !== 'ready' || teams.isError) {
    return { teams: [], isLoading: false, isError: account.status === 'error' || teams.isError }
  }

  const user = account.user
  const managed = user.isAdmin
    ? teams.data
    : teams.data.filter((t) => user.roleForTeam(t.id) === 'manager')

  return { teams: [...managed].sort(byActiveThenName), isLoading: false, isError: false }
}
