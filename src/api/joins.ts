import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { eventKeys, userKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import { AppError } from '@/lib/errors'

/**
 * The client half of the two join RPCs (S2.4). Clients never write `team_members` directly (D9):
 * a membership is only ever created by `join_team_by_token` or `join_team_by_event`. Both are
 * idempotent — `on conflict (team_id, user_id) do nothing` — so a second call makes no second row
 * and never resets `joined_at` (D26); the client cannot tell a first join from a repeat and does
 * not try (the success copy is neutral).
 *
 * The lookup half, `useInviteLookup`, is not here: S6.2 already ships it in `src/api/invites.ts`
 * over `lookup_team_invite`, and two exports in `src/api/` cannot share a name. This module is
 * the joins alone.
 *
 * Both mutations invalidate `userKeys.current()` — S2.9's `useCurrentUser`, so the new membership
 * is live before any screen re-renders — and `eventKeys.all`, so the deep-linked event refetches
 * and renders as the member view without a reload (AC10).
 */

export interface JoinedTeam {
  teamId: string
  teamName: string
}

/** The join RPCs return exactly one row on success and raise `invalid_invite` otherwise (D26);
 *  the empty-set guard is defence `noUncheckedIndexedAccess` makes a compile requirement. */
function firstJoined(rows: readonly { team_id: string; team_name: string }[]): JoinedTeam {
  const row = rows[0]
  if (!row) throw new AppError('invalid_invite')
  return { teamId: row.team_id, teamName: row.team_name }
}

/** Joins the caller to the invite's team, taking the granted role from the invite row, never a
 *  client argument (D9). A spent or revoked token raises `invalid_invite`. */
export function useJoinTeamByToken(): UseMutationResult<JoinedTeam, AppError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (token: string): Promise<JoinedTeam> =>
      firstJoined(await callRpc('join_team_by_token', { p_token: token })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.current() })
      void qc.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

/**
 * Joins the caller to the team that owns an event, as a player (D6). The event link is a standing
 * join credential with the same trust basis as the squad WhatsApp group, so this is the join S3.3
 * offers a signed-in non-member. The RPC raises `invalid_invite` for an inactive team, an unknown
 * event, or one that started more than seven days ago.
 */
export function useJoinTeamByEvent(): UseMutationResult<JoinedTeam, AppError, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (eventId: string): Promise<JoinedTeam> =>
      firstJoined(await callRpc('join_team_by_event', { p_event_id: eventId })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: userKeys.current() })
      void qc.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}
