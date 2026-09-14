import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { eventKeys, teamKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import {
  byRoleThenName,
  memberDirectoryRowSchema,
  type MemberDirectoryRow,
  type MemberRole,
} from '@/features/teams/schema'
import type { AppError } from '@/lib/errors'

/**
 * The client half of the membership-admin RPCs (S6.4). Clients never touch `team_members`
 * directly (D9): the directory read and all three writes are security-definer functions, so a
 * player who reaches an action anyway is refused by the RPC regardless of what the UI rendered.
 * Phone numbers arrive here only for a manager of the team or an admin (null otherwise, D8) and
 * are never written to a key, a log or a URL from this module (D16).
 */

/**
 * The squad, sorted managers-first then by name (AC1). `team_member_directory` returns rows to
 * any member of the team, `phone` null for non-managers; the screen guard, not this read, keeps
 * a player out (convenience only). Sorted in `select` so the list and every dialog share one
 * order through the cache — the AC8/gotcha "one query per screen" rule.
 */
export function useTeamMembers(teamId: string): UseQueryResult<MemberDirectoryRow[]> {
  return useQuery({
    queryKey: teamKeys.members(teamId),
    queryFn: async (): Promise<MemberDirectoryRow[]> => {
      const rows = await callRpc('team_member_directory', { p_team_id: teamId })
      return rows.map((r) => memberDirectoryRowSchema.parse(r))
    },
    select: (rows) => [...rows].sort(byRoleThenName),
  })
}

/** Snapshot for the D48 rollback: the unsorted list under the members key. */
interface MemberListContext {
  members: MemberDirectoryRow[] | undefined
}

/**
 * Removes a membership through `remove_member` (D9, D33). A manager may remove only a player on a
 * team they manage; an admin may remove anyone — the RPC enforces both and raises `not_authorised`
 * otherwise. Optimistic (D48): `onMutate` drops the row so the squad shrinks at once, `onError`
 * restores it, `onSettled` invalidates the members key **and** `eventKeys.all`, because squad size
 * feeds S4.3's awaiting count (D22) and those counts derive from the event queries. Deleting the
 * row deletes nothing else: the person's responses and attendance stay (D33), proved in S1.4.
 */
export function useRemoveMember(
  teamId: string,
): UseMutationResult<void, AppError, { userId: string }, MemberListContext> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId }): Promise<void> => {
      await callRpc('remove_member', { p_team_id: teamId, p_user_id: userId })
    },
    onMutate: async ({ userId }) => {
      await qc.cancelQueries({ queryKey: teamKeys.members(teamId) })
      const members = qc.getQueryData<MemberDirectoryRow[]>(teamKeys.members(teamId))
      if (members) {
        qc.setQueryData(
          teamKeys.members(teamId),
          members.filter((m) => m.user_id !== userId),
        )
      }
      return { members }
    },
    onError: (_error, _vars, ctx) => {
      if (ctx) qc.setQueryData(teamKeys.members(teamId), ctx.members)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.members(teamId) })
      void qc.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

/**
 * Changes a member's role between player and manager through `set_member_role` (admin only, D2/D9;
 * a manager caller raises `not_authorised`). Admin is never a value — the enum has no `admin`
 * member. Optimistic like remove: the badge and the sort position move on `onMutate`, revert on
 * `onError`. `joined_at` is untouched (D26, AC6). Invalidates the members key and `eventKeys.all`,
 * since a promotion does not change squad size but a demotion still churns the same S4.3 counts.
 */
export function useSetMemberRole(
  teamId: string,
): UseMutationResult<void, AppError, { userId: string; role: MemberRole }, MemberListContext> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, role }): Promise<void> => {
      await callRpc('set_member_role', { p_team_id: teamId, p_user_id: userId, p_role: role })
    },
    onMutate: async ({ userId, role }) => {
      await qc.cancelQueries({ queryKey: teamKeys.members(teamId) })
      const members = qc.getQueryData<MemberDirectoryRow[]>(teamKeys.members(teamId))
      if (members) {
        qc.setQueryData(
          teamKeys.members(teamId),
          members.map((m) => (m.user_id === userId ? { ...m, role } : m)),
        )
      }
      return { members }
    },
    onError: (_error, _vars, ctx) => {
      if (ctx) qc.setQueryData(teamKeys.members(teamId), ctx.members)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.members(teamId) })
      void qc.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

/**
 * Corrects a member's phone through `set_member_phone` (admin only, D51). The RPC validates E.164,
 * updates `auth.users.phone` and `profiles.phone` in one transaction, and raises `phone_taken` on
 * a duplicate rather than surfacing a Postgres unique violation (AC10). Not optimistic — the value
 * is not this screen's to render — so it shows a pending state in its dialog and invalidates only
 * the members key on success. `teamId` is not a parameter: the correction is club-wide, not scoped
 * to a team; `teamId` is passed only to invalidate the members list already on screen.
 */
export function useSetMemberPhone(
  teamId: string,
): UseMutationResult<void, AppError, { userId: string; phone: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, phone }): Promise<void> => {
      await callRpc('set_member_phone', { p_user_id: userId, p_phone: phone })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: teamKeys.members(teamId) }),
  })
}
