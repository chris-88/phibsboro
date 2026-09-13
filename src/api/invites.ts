import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { queryOptions } from '@tanstack/react-query'
import { teamKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import {
  teamInviteLookupSchema,
  teamInviteViewSchema,
  type MemberRole,
  type TeamInviteLookup,
  type TeamInviteView,
} from '@/features/teams/schema'
import type { AppError } from '@/lib/errors'

/**
 * The client half of the invite RPCs (S6.2). Clients never touch `team_invites` directly (D9):
 * every read and write is one of the three security-definer functions. `get_team_invite` is a
 * lookup — zero rows, never an error, on every failure including an unauthorised caller (S1.3),
 * so `null` means "no live link", not "something broke".
 *
 * Tokens live only in this in-memory query cache. No persister is installed and nothing here
 * writes a token to storage or a log (AC11, AC12); the token is a bearer credential (D62).
 */
/**
 * The team behind a join token, read before auth so the register screen can name it (S2.1 AC2).
 * Granted to `anon`, so it resolves for a stranger arriving cold. `null` means the token is
 * unknown, expired, revoked or on an inactive team — one indistinguishable dead-link state, by
 * design (D28), which S2.1 renders as `LinkProblem`. Split into options so it can be prefetched.
 */
export function inviteLookupOptions(token: string | undefined) {
  return queryOptions({
    queryKey: teamKeys.lookup(token ?? ''),
    enabled: Boolean(token),
    staleTime: 60_000,
    queryFn: async (): Promise<TeamInviteLookup | null> => {
      if (!token) return null
      const rows = await callRpc('lookup_team_invite', { p_token: token })
      const first = rows[0]
      return first ? teamInviteLookupSchema.parse(first) : null
    },
  })
}

export function useInviteLookup(
  token: string | undefined,
): UseQueryResult<TeamInviteLookup | null> {
  return useQuery(inviteLookupOptions(token))
}

export function useTeamInvite(
  teamId: string,
  role: MemberRole,
): UseQueryResult<TeamInviteView | null> {
  return useQuery({
    queryKey: teamKeys.invite(teamId, role),
    queryFn: async (): Promise<TeamInviteView | null> => {
      const rows = await callRpc('get_team_invite', { p_team_id: teamId, p_role: role })
      const first = rows[0]
      return first === undefined ? null : teamInviteViewSchema.parse(first)
    },
    // A revoked token must not linger behind a back navigation, so nothing is ever fresh and
    // the cache is dropped a minute after the panel unmounts.
    staleTime: 0,
    gcTime: 60_000,
  })
}

/**
 * Mints the live link for `(teamId, role)`, returning the new token. Also the regenerate path:
 * `create_team_invite` deactivates the current row and inserts the replacement in one
 * transaction (D29), so regenerate is this same mutation with different button copy. Not
 * optimistic — there is no token to show before the server mints one — so it invalidates and
 * lets `useTeamInvite` refetch the full row.
 */
export function useCreateTeamInvite(
  teamId: string,
): UseMutationResult<string, AppError, MemberRole> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (role: MemberRole): Promise<string> =>
      callRpc('create_team_invite', { p_team_id: teamId, p_role: role }),
    onSuccess: (_token, role) => qc.invalidateQueries({ queryKey: teamKeys.invite(teamId, role) }),
  })
}

/** Revokes the live link for `(teamId, role)`. The old token stops resolving at once, with no
 *  grace period; memberships already created are untouched (AC7). */
export function useRevokeTeamInvite(teamId: string): UseMutationResult<void, AppError, MemberRole> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (role: MemberRole): Promise<void> => {
      await callRpc('revoke_team_invite', { p_team_id: teamId, p_role: role })
    },
    onSuccess: (_void, role) => qc.invalidateQueries({ queryKey: teamKeys.invite(teamId, role) }),
  })
}
