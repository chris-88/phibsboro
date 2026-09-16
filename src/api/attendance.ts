import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { eventKeys } from '@/api/queryKeys'
import { useSession } from '@/features/auth/session-context'
import type { RosterAttendance } from '@/lib/roster'
import { supabase } from '@/lib/supabase'

/** A single attendance edit. `attended === null` clears the row (D25). */
export interface AttendanceInput {
  userId: string
  attended: boolean | null
}

/** Snapshot of the one cache both hooks touch — `eventKeys.attendance` — for rollback (D48). */
type AttendanceSnapshot = RosterAttendance[] | undefined

/** Apply one edit to the cached roster-attendance array: replace, insert or drop the row. */
function applyOne(
  rows: RosterAttendance[] | undefined,
  { userId, attended }: AttendanceInput,
): RosterAttendance[] {
  const without = (rows ?? []).filter((r) => r.userId !== userId)
  return attended === null ? without : [...without, { userId, attended }]
}

/**
 * The single attendance write for one player at `/manage/event/:id` (S4.5). An upsert on the
 * `(event_id, user_id)` primary key for attended/absent, a delete for "not recorded", so tapping
 * twice leaves one row and clearing removes it (AC2, AC3). Always sends `recorded_by: user.id`; a
 * forged uuid is refused `42501` by S1.3's `with check`, not silently rewritten (AC4). `updated_at`
 * is stamped by S1.1's trigger and never sent.
 *
 * Optimistic per D48: `onMutate` cancels the attendance query, snapshots it, writes the new value
 * into the cache, returns the snapshot; `onError` restores it; `onSettled` invalidates
 * `eventKeys.attendance(eventId)` and nothing else, so S4.3's counts and the directory never
 * refetch on an attendance write (AC12). `PostgrestError`, not `AppError`: a table write, so it
 * follows S4.1's convention. The per-row saving and failed sets live in the screen, driven by the
 * per-call callbacks the caller passes to `mutate`.
 */
export function useSetAttendance(
  eventId: string,
): UseMutationResult<void, PostgrestError, AttendanceInput, AttendanceSnapshot> {
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined
  const key = eventKeys.attendance(eventId)

  // The type annotation, not a generic on `useMutation`, carries `void` — the lint forbids `void`
  // in a generic argument position (mirrors availability.ts).
  const mutation: UseMutationResult<void, PostgrestError, AttendanceInput, AttendanceSnapshot> =
    useMutation({
      mutationFn: async ({ userId: subjectId, attended }) => {
        // Only rendered inside the manager view, so a signed-in user is guaranteed; the guard keeps
        // the type honest rather than guarding a reachable path.
        if (userId === undefined) throw new Error('not signed in')
        if (attended === null) {
          const { error } = await supabase
            .from('attendance')
            .delete()
            .eq('event_id', eventId)
            .eq('user_id', subjectId)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('attendance')
            .upsert(
              { event_id: eventId, user_id: subjectId, attended, recorded_by: userId },
              { onConflict: 'event_id,user_id' },
            )
          if (error) throw error
        }
      },
      onMutate: async (input) => {
        await qc.cancelQueries({ queryKey: key })
        const snapshot = qc.getQueryData<RosterAttendance[]>(key)
        qc.setQueryData<RosterAttendance[]>(key, applyOne(snapshot, input))
        return snapshot
      },
      onError: (_error, _input, snapshot) => {
        qc.setQueryData<RosterAttendance[]>(key, snapshot)
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: key })
      },
    })

  return mutation
}

/**
 * The bulk action beside S4.3's counts (S4.5). One statement fills the blanks for the passed
 * `userIds` — the current members whose response is `available`, taken from the cached roster — with
 * `on conflict do nothing`, so an existing `Absent` survives and nobody awaiting, unavailable or
 * departed is touched (AC5). Returns the number of rows actually inserted, the figure AC6 announces.
 * Never loops the single write: a squad of twenty would fire twenty requests.
 */
export function useBulkMarkAttended(
  eventId: string,
): UseMutationResult<number, PostgrestError, string[], AttendanceSnapshot> {
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined
  const key = eventKeys.attendance(eventId)

  const mutation: UseMutationResult<number, PostgrestError, string[], AttendanceSnapshot> =
    useMutation({
      mutationFn: async (userIds) => {
        if (userId === undefined) throw new Error('not signed in')
        if (userIds.length === 0) return 0
        const { data, error } = await supabase
          .from('attendance')
          .upsert(
            userIds.map((user_id) => ({
              event_id: eventId,
              user_id,
              attended: true,
              recorded_by: userId,
            })),
            { onConflict: 'event_id,user_id', ignoreDuplicates: true },
          )
          // ignoreDuplicates compiles to `on conflict do nothing`, so this returns only the rows
          // actually inserted — the count announced in AC6.
          .select('user_id')
        if (error) throw error
        return data.length
      },
      onMutate: async (userIds) => {
        await qc.cancelQueries({ queryKey: key })
        const snapshot = qc.getQueryData<RosterAttendance[]>(key)
        // Only fill blanks: a user already carrying a row keeps it, mirroring `do nothing` (AC5).
        const present = new Set((snapshot ?? []).map((r) => r.userId))
        const additions = userIds
          .filter((id) => !present.has(id))
          .map((id) => ({ userId: id, attended: true }))
        qc.setQueryData<RosterAttendance[]>(key, [...(snapshot ?? []), ...additions])
        return snapshot
      },
      onError: (_error, _userIds, snapshot) => {
        qc.setQueryData<RosterAttendance[]>(key, snapshot)
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: key })
      },
    })

  return mutation
}
