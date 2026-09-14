import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { z } from 'zod'
import { callRpc } from '@/api/rpc'
import { eventKeys } from '@/api/queryKeys'
import { squadRowSchema, type SquadRow } from '@/features/events/schema'
import type { AppError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

// S9.1 — the matchday squad data layer (V6). One read of a match's picked side and the three
// manager writes behind it. Every write goes through a security-definer RPC (set_squad_member /
// remove_squad_member / clear_squad), so the manager-only and available-only rules are enforced in
// the database (the table policies are the backstop, S9.1) and a refusal arrives as one of the
// three squad `AppError` codes rather than a raw Postgres message. The picker UI is S9.2.

/** The columns the picker reads, shirt-order. RLS narrows the rows to the event's team members. */
const SQUAD_SELECT = 'event_id, user_id, shirt_number, is_captain, recorded_by, updated_at' as const

/**
 * The picked squad for one event, ordered by shirt number (S9.2's read). The select policy on
 * `event_squad` restricts the rows to the event's team, so no client-side team filter is needed.
 * Parsed at the boundary through `squadRowSchema`, so a PostgREST shape change fails here.
 */
export function useEventSquad(eventId: string) {
  return useQuery<SquadRow[]>({
    queryKey: eventKeys.squad(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_squad')
        .select(SQUAD_SELECT)
        .eq('event_id', eventId)
        .order('shirt_number', { ascending: true })
      if (error) throw error
      return z.array(squadRowSchema).parse(data)
    },
  })
}

/** One squad pick: the player, their number, and whether they wear the armband. */
export interface SquadMemberInput {
  userId: string
  shirtNumber: number
  isCaptain: boolean
}

/**
 * Add or renumber one player in the squad (S9.2). Delegates to `set_squad_member`, which checks
 * the caller manages the team, the player is an available responder (V7), and the number and
 * captain are free — raising `not_authorised`, `not_available`, `number_taken` or `captain_taken`
 * on refusal. `recorded_by` is the RPC's `auth.uid()`, never sent from the client (AC6). Settles
 * by invalidating only `eventKeys.squad(eventId)`.
 */
export function useSetSquadMember(
  eventId: string,
): UseMutationResult<void, AppError, SquadMemberInput> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, AppError, SquadMemberInput> = useMutation({
    mutationFn: async ({ userId, shirtNumber, isCaptain }) => {
      await callRpc('set_squad_member', {
        p_event_id: eventId,
        p_user_id: userId,
        p_shirt_number: shirtNumber,
        p_is_captain: isCaptain,
      })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.squad(eventId) })
    },
  })
  return mutation
}

/** Drop one player from the squad (S9.2). `remove_squad_member` refuses a non-manager. */
export function useRemoveSquadMember(eventId: string): UseMutationResult<void, AppError, string> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, AppError, string> = useMutation({
    mutationFn: async (userId) => {
      await callRpc('remove_squad_member', { p_event_id: eventId, p_user_id: userId })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.squad(eventId) })
    },
  })
  return mutation
}

/** Clear the whole squad for an event (S9.2). `clear_squad` refuses a non-manager. */
export function useClearSquad(eventId: string): UseMutationResult<void, AppError, void> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, AppError, void> = useMutation({
    mutationFn: async () => {
      await callRpc('clear_squad', { p_event_id: eventId })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.squad(eventId) })
    },
  })
  return mutation
}
