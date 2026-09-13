import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import type { EventDetail } from '@/api/events'
import { eventKeys } from '@/api/queryKeys'
import { useSession } from '@/features/auth/session-context'
import type { AvailabilityResponse } from '@/features/availability/schema'
import { supabase } from '@/lib/supabase'

export interface SetResponseVars {
  eventId: string
  response: AvailabilityResponse
}

/** Snapshot for rollback (D48). Only the detail cache is owned here; the upcoming list's shape is
 *  S3.1's, so this story refreshes it through `onSettled` rather than writing a speculative row. */
interface SetResponseContext {
  detail: EventDetail | null | undefined
}

/**
 * The one availability write, shared by S3.1, S3.3 and S3.4 (D48, D61). Optimistic: `onMutate`
 * writes the new answer into the detail cache before the request resolves, so the button reflects
 * it immediately (AC5); `onError` restores the snapshot and leaves the buttons enabled, and the
 * component renders the failure line (AC8); `onSettled` invalidates every event query so the
 * server's answer — including a D12 refusal on a started or cancelled event — becomes the truth,
 * which is why there is no `retry`. There is no DELETE: a player switches between the two values
 * but never returns to awaiting (D61); `AvailabilityButtons` fires nothing when the tapped value
 * already matches.
 */
export function useSetResponse(): UseMutationResult<
  void,
  PostgrestError,
  SetResponseVars,
  SetResponseContext
> {
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined

  return useMutation({
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
      return { detail }
    },
    onError: (_error, { eventId }, ctx) => {
      if (ctx) qc.setQueryData(eventKeys.detail(eventId), ctx.detail)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: eventKeys.all }),
  })
}
