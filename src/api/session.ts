import { queryOptions, useQuery } from '@tanstack/react-query'
import { userKeys } from '@/api/queryKeys'
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
