import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import type { EventDetail, UpcomingEvent } from '@/api/events'
import { eventKeys } from '@/api/queryKeys'
import { useSession } from '@/features/auth/session-context'
import type { AvailabilityResponse } from '@/features/availability/schema'
import { supabase } from '@/lib/supabase'

export interface SetResponseVars {
  eventId: string
  response: AvailabilityResponse
}

/** S3.3's mutation surface plus one derived flag. A `42501` refusal from the D12 `WITH CHECK` means
 *  the window shut between render and tap — a stale screen, not a retryable failure — so the "Tap
 *  again." line must not show for it (S3.4 AC9). The distinction is made once, here, never in a
 *  component (AC13). */
export type SetResponseMutation = UseMutationResult<
  void,
  PostgrestError,
  SetResponseVars,
  SetResponseContext
> & { showRetryLine: boolean }

/** Snapshot for rollback (D48). Both caches an answer can appear in are held: the detail cache
 *  behind the event screen (S3.3), and the upcoming list behind the home card (S3.1), so a tap on
 *  either reflects immediately and rolls back together. */
interface SetResponseContext {
  detail: EventDetail | null | undefined
  upcoming: UpcomingEvent[] | undefined
}

/**
 * The one availability write, shared by S3.1, S3.3 and S3.4 (D48, D61). Optimistic: `onMutate`
 * writes the new answer into the detail cache before the request resolves, so the button reflects
 * it immediately (AC5); `onError` restores the snapshot and leaves the buttons enabled, and the
 * component renders the failure line (AC8); `onSettled` invalidates every event query so the
 * server's answer — including a D12 refusal on a started or cancelled event — becomes the truth,
 * which is why there is no `retry`. There is no DELETE: a player switches between the two values
 * but never returns to awaiting (D61); `AvailabilityButtons` fires nothing when the tapped value
 * already matches. A `42501` refusal is swallowed after the rollback and a refetch (S3.4 AC9): the
 * refetch produces the correct closed screen, so `showRetryLine` — not `isError` — drives the
 * inline "Tap again." line.
 */
export function useSetResponse(): SetResponseMutation {
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined

  const mutation: UseMutationResult<void, PostgrestError, SetResponseVars, SetResponseContext> =
    useMutation({
      mutationFn: async ({ eventId, response }) => {
        // Only rendered below a member view, so a signed-in user is guaranteed; the guard keeps
        // the type honest rather than guarding a reachable path.
        if (userId === undefined) throw new Error('not signed in')
        const { error } = await supabase
          .from('event_responses')
          .upsert(
            { event_id: eventId, user_id: userId, response },
            { onConflict: 'event_id,user_id' },
          )
        if (error) throw error
      },
      onMutate: async ({ eventId, response }) => {
        await qc.cancelQueries({ queryKey: eventKeys.all })
        const detail = qc.getQueryData<EventDetail | null>(eventKeys.detail(eventId))
        if (detail) {
          const next: EventDetail = { ...detail, myResponse: response }
          qc.setQueryData(eventKeys.detail(eventId), next)
        }
        // The home card reads from the upcoming list; update it too so a tap on the card fills the
        // button before the request resolves (S3.1 AC7). Keyed on the signed-in user (D39).
        const upcomingKey = userId === undefined ? undefined : eventKeys.upcoming(userId)
        const upcoming = upcomingKey ? qc.getQueryData<UpcomingEvent[]>(upcomingKey) : undefined
        if (upcomingKey && upcoming) {
          qc.setQueryData(
            upcomingKey,
            upcoming.map((e) => (e.id === eventId ? { ...e, myResponse: response } : e)),
          )
        }
        return { detail, upcoming }
      },
      onError: (error, { eventId }, ctx) => {
        if (ctx) {
          qc.setQueryData(eventKeys.detail(eventId), ctx.detail)
          if (userId !== undefined) qc.setQueryData(eventKeys.upcoming(userId), ctx.upcoming)
        }
        // 42501 = the D12 WITH CHECK refused it: the window shut under the player's feet. Refetch so
        // the screen settles into the started or cancelled state; swallow, since "Tap again." would
        // be a lie (AC9). Every other failure falls through to showRetryLine below (AC10).
        if (error.code === '42501') {
          void qc.invalidateQueries({ queryKey: eventKeys.all })
        }
      },
      onSettled: () => qc.invalidateQueries({ queryKey: eventKeys.all }),
    })

  // a 42501 is a stale screen, not a retryable failure, so it never shows the line (AC9)
  return { ...mutation, showRetryLine: mutation.isError && mutation.error.code !== '42501' }
}
