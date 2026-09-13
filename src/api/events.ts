import { queryOptions, useQuery } from '@tanstack/react-query'
import { eventKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import { eventPreviewSchema, type EventPreview } from '@/features/events/schema'

/**
 * The worked example every later hook copies (S1.5). Options and hook are split so the same
 * query can be prefetched or fetched outside React — S2.5's deep-link return path, and the
 * hosted integration test — and the hook is nothing but `useQuery(options)`.
 *
 * `null` means not found. It is a state, not an error: the preview RPC returns zero rows for
 * an unknown id and never raises (D7), and S3.3 renders its 404 from it.
 */
export function eventPreviewOptions(eventId: string | undefined) {
  return queryOptions({
    queryKey: eventKeys.preview(eventId ?? ''),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventPreview | null> => {
      if (!eventId) return null
      const rows = await callRpc('get_event_preview', { p_event_id: eventId })
      const first = rows[0]
      return first ? eventPreviewSchema.parse(first) : null
    },
  })
}

export function useEventPreview(eventId: string | undefined) {
  return useQuery(eventPreviewOptions(eventId))
}
