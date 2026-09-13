import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { teamKeys, userKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import { supabase } from '@/lib/supabase'

/**
 * A narrow, temporary admin gate for S6.1. There is no sign-in screen at build order 13, so
 * this is the "inline" isAdmin check the story's Open question 3 describes; S2.9 replaces it
 * with `useCurrentUser().isAdmin` behind a `RequireAdmin` guard, with no change in behaviour.
 *
 * The redirect it feeds is convenience only. RLS is the enforcement layer: a non-admin insert
 * or update on `teams` affects zero rows regardless of what the UI renders (S1.4). Reads own
 * profile row, which the profiles select policy allows.
 */
export function isAdminOptions() {
  return queryOptions({
    queryKey: userKeys.current(),
    queryFn: async (): Promise<boolean> => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return false
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .maybeSingle()
      if (error) throw error
      return data?.is_admin ?? false
    },
  })
}

export function useIsAdmin() {
  return useQuery(isAdminOptions())
}

/**
 * True when the caller manages the team or is an admin — the `is_team_manager` helper is itself
 * `is_admin() or ...`, so an admin who is not a member still passes (S6.2 gotcha). This is the
 * convenience gate for the members screen: a player resolves to `false` and is redirected. It is
 * convenience only. RLS is the enforcement layer — the invite RPCs refuse a player regardless of
 * what the UI renders (S1.4). Superseded by `useCurrentUser()` once S2.9 lands, with no change in
 * behaviour.
 */
export function useIsTeamManager(teamId: string): UseQueryResult<boolean> {
  return useQuery({
    queryKey: teamKeys.managerGate(teamId),
    queryFn: (): Promise<boolean> => callRpc('is_team_manager', { p_team_id: teamId }),
  })
}
