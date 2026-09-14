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

// S9.1 — the matchday squad data layer (V6). One read of a match's picked side and the manager
// writes behind it. Every write goes through a security-definer RPC (set_squad_member /
// remove_squad_member / clear_squad), so the manager-only and available-only rules are enforced in
// the database (the table policies are the backstop, S9.1) and a refusal arrives as one of the
// three squad `AppError` codes rather than a raw Postgres message.
//
// S9.2 makes the three writes optimistic on `eventKeys.squad(eventId)` with rollback, so the
// picker fills and empties under the thumb before the RPC resolves.

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

/** Snapshot for the D48 rollback: the squad rows under this event's squad key. */
interface SquadContext {
  previous: SquadRow[] | undefined
}

/** One squad pick: the player, their number, and whether they wear the armband. */
export interface SquadMemberInput {
  userId: string
  shirtNumber: number
  isCaptain: boolean
}

/** The optimistic row written into the cache before the RPC settles. `recorded_by`/`updated_at`
 *  are audit columns the picker never renders, so a placeholder stands in until the refetch on
 *  settle replaces the whole row with the server's truth. */
function optimisticUpsert(
  previous: SquadRow[],
  eventId: string,
  { userId, shirtNumber, isCaptain }: SquadMemberInput,
): SquadRow[] {
  const existing = previous.find((r) => r.user_id === userId)
  const next: SquadRow = {
    event_id: eventId,
    user_id: userId,
    shirt_number: shirtNumber,
    is_captain: isCaptain,
    recorded_by: existing?.recorded_by ?? userId,
    updated_at: existing?.updated_at ?? '',
  }
  const others = previous.filter((r) => r.user_id !== userId)
  return [...others, next].sort((a, b) => a.shirt_number - b.shirt_number)
}

/**
 * Add or renumber one player in the squad (S9.2). Delegates to `set_squad_member`, which checks
 * the caller manages the team, the player is an available responder (V7), and the number and
 * captain are free — raising `not_authorised`, `not_available`, `number_taken` or `captain_taken`
 * on refusal. `recorded_by` is the RPC's `auth.uid()`, never sent from the client (AC6). Optimistic
 * on `eventKeys.squad(eventId)`; rolls the snapshot back on error and re-syncs on settle.
 */
export function useSetSquadMember(
  eventId: string,
): UseMutationResult<void, AppError, SquadMemberInput, SquadContext> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, AppError, SquadMemberInput, SquadContext> = useMutation({
    mutationFn: async ({ userId, shirtNumber, isCaptain }) => {
      await callRpc('set_squad_member', {
        p_event_id: eventId,
        p_user_id: userId,
        p_shirt_number: shirtNumber,
        p_is_captain: isCaptain,
      })
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: eventKeys.squad(eventId) })
      const previous = qc.getQueryData<SquadRow[]>(eventKeys.squad(eventId))
      if (previous) {
        qc.setQueryData<SquadRow[]>(
          eventKeys.squad(eventId),
          optimisticUpsert(previous, eventId, input),
        )
      }
      return { previous }
    },
    onError: (_error, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(eventKeys.squad(eventId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.squad(eventId) })
    },
  })
  return mutation
}

/** Naming the captain (S9.2). At most one captain per match, so making a new one first clears the
 *  old — two `set_squad_member` calls, since the S9.1 RPC refuses a second captain (`captain_taken`)
 *  rather than swapping. Everything the calls need travels in the variables, not read back from the
 *  cache, so `onMutate`'s optimistic edit cannot mislead the mutation. */
export interface SetCaptainInput {
  userId: string
  shirtNumber: number
  /** True to make this player captain, false to strip the armband. */
  makeCaptain: boolean
  /** The current captain to clear first, when making a different player captain. */
  previousCaptain: { userId: string; shirtNumber: number } | null
}

export function useSetCaptain(
  eventId: string,
): UseMutationResult<void, AppError, SetCaptainInput, SquadContext> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, AppError, SetCaptainInput, SquadContext> = useMutation({
    mutationFn: async ({ userId, shirtNumber, makeCaptain, previousCaptain }) => {
      if (makeCaptain && previousCaptain && previousCaptain.userId !== userId) {
        await callRpc('set_squad_member', {
          p_event_id: eventId,
          p_user_id: previousCaptain.userId,
          p_shirt_number: previousCaptain.shirtNumber,
          p_is_captain: false,
        })
      }
      await callRpc('set_squad_member', {
        p_event_id: eventId,
        p_user_id: userId,
        p_shirt_number: shirtNumber,
        p_is_captain: makeCaptain,
      })
    },
    onMutate: async ({ userId, makeCaptain }) => {
      await qc.cancelQueries({ queryKey: eventKeys.squad(eventId) })
      const previous = qc.getQueryData<SquadRow[]>(eventKeys.squad(eventId))
      if (previous) {
        qc.setQueryData<SquadRow[]>(
          eventKeys.squad(eventId),
          previous.map((r) =>
            r.user_id === userId
              ? { ...r, is_captain: makeCaptain }
              : makeCaptain
                ? { ...r, is_captain: false }
                : r,
          ),
        )
      }
      return { previous }
    },
    onError: (_error, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(eventKeys.squad(eventId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.squad(eventId) })
    },
  })
  return mutation
}

/** Drop one player from the squad (S9.2). `remove_squad_member` refuses a non-manager. Optimistic:
 *  the row disappears at once, restored on error. */
export function useRemoveSquadMember(
  eventId: string,
): UseMutationResult<void, AppError, string, SquadContext> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, AppError, string, SquadContext> = useMutation({
    mutationFn: async (userId) => {
      await callRpc('remove_squad_member', { p_event_id: eventId, p_user_id: userId })
    },
    onMutate: async (userId) => {
      await qc.cancelQueries({ queryKey: eventKeys.squad(eventId) })
      const previous = qc.getQueryData<SquadRow[]>(eventKeys.squad(eventId))
      if (previous) {
        qc.setQueryData<SquadRow[]>(
          eventKeys.squad(eventId),
          previous.filter((r) => r.user_id !== userId),
        )
      }
      return { previous }
    },
    onError: (_error, _userId, ctx) => {
      if (ctx?.previous) qc.setQueryData(eventKeys.squad(eventId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.squad(eventId) })
    },
  })
  return mutation
}

/** Clear the whole squad for an event (S9.2). `clear_squad` refuses a non-manager. Optimistic. */
export function useClearSquad(
  eventId: string,
): UseMutationResult<void, AppError, void, SquadContext> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, AppError, void, SquadContext> = useMutation({
    mutationFn: async () => {
      await callRpc('clear_squad', { p_event_id: eventId })
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: eventKeys.squad(eventId) })
      const previous = qc.getQueryData<SquadRow[]>(eventKeys.squad(eventId))
      qc.setQueryData<SquadRow[]>(eventKeys.squad(eventId), [])
      return { previous }
    },
    onError: (_error, _void, ctx) => {
      if (ctx?.previous) qc.setQueryData(eventKeys.squad(eventId), ctx.previous)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.squad(eventId) })
    },
  })
  return mutation
}
