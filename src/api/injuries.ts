import { useMemo } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { z } from 'zod'
import { injuryKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import { useSession } from '@/features/auth/session-context'
import { playerInjuryRowSchema, type PlayerInjuryRow } from '@/features/injury/schema'
import type { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

/**
 * The injury data layer (S20.3). A row in `player_injuries` means the player is currently injured;
 * no row means fit. Reads are direct and RLS-scoped — `useInjuries` returns exactly what the caller
 * may see (own, plus players on teams they manage; all for an admin) — so one query backs both the
 * profile card and the roster. Writes go through the `set_injury`/`clear_injury` security-definer
 * RPCs (Z2: self, a manager of the player's team, or an admin), which invalidate the whole family.
 */
export function useInjuries(): UseQueryResult<PlayerInjuryRow[]> {
  return useQuery({
    queryKey: injuryKeys.visible(),
    queryFn: async (): Promise<PlayerInjuryRow[]> => {
      const { data, error } = await supabase
        .from('player_injuries')
        .select('user_id, expected_return, note, updated_by, updated_at')
      if (error) throw error
      return z.array(playerInjuryRowSchema).parse(data)
    },
  })
}

/**
 * The signed-in player's own current injury, derived from the same RLS-scoped read as the roster
 * (like `useMySubs`). `null` means fit; `undefined` while it loads. For the profile injury card.
 */
export function useMyInjury(): {
  data: PlayerInjuryRow | null | undefined
  isPending: boolean
  isError: boolean
} {
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined
  const injuries = useInjuries()

  const data = useMemo<PlayerInjuryRow | null | undefined>(() => {
    if (!injuries.data || userId === undefined) return undefined
    return injuries.data.find((i) => i.user_id === userId) ?? null
  }, [injuries.data, userId])

  return { data, isPending: injuries.isPending, isError: injuries.isError }
}

/** Mark a player injured, or update their expected return / note (Z2). Empty fields are null. */
export function useSetInjury(): UseMutationResult<
  void,
  AppError,
  { userId: string; expectedReturn: string | null; note: string | null }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, expectedReturn, note }): Promise<void> => {
      // The detail params are optional: omitting one sends null, which clears that field (the RPC
      // default). So a cleared date or note on an update is expressed by leaving the arg out.
      await callRpc('set_injury', {
        p_user_id: userId,
        ...(expectedReturn !== null ? { p_expected_return: expectedReturn } : {}),
        ...(note !== null ? { p_note: note } : {}),
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: injuryKeys.all })
    },
  })
}

/** Mark a player fit again — removes the injury row (Z2). */
export function useClearInjury(): UseMutationResult<void, AppError, { userId: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId }): Promise<void> => {
      await callRpc('clear_injury', { p_user_id: userId })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: injuryKeys.all })
    },
  })
}
