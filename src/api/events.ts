import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query'
import { eventKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import type { AvailabilityResponse } from '@/features/availability/schema'
import { useSession } from '@/features/auth/session-context'
import {
  eventPreviewSchema,
  eventWithResponseSchema,
  type EventPreview,
  type EventStatus,
  type EventType,
} from '@/features/events/schema'
import { supabase } from '@/lib/supabase'

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

/** The flat, camelCase member view of one event. No component touches a snake_case row (S1.5). */
export interface EventDetail {
  id: string
  teamId: string
  teamName: string
  type: EventType
  title: string
  location: string
  notes: string | null
  startsAt: string
  status: EventStatus
  /** The caller's own answer, or null while awaiting. Never a teammate's (D32, AC15). */
  myResponse: AvailabilityResponse | null
}

/**
 * The single round trip behind the member view (S3.3). `teams!inner(name)` drops an event whose
 * team row the caller cannot read, so a non-member gets `data: null` rather than a null team;
 * `.eq('event_responses.user_id', userId)` is correctness, not an optimisation — a manager's read
 * policy returns every squad member's row, and without the filter the embed is an array of the
 * whole squad (D32, AC15). `maybeSingle()` returns `null` with no error when RLS filters the row
 * out, which is exactly the "not a member" signal S3.3 falls through to the preview on.
 */
export const EVENT_SELECT =
  'id, team_id, type, title, location, notes, starts_at, status, teams!inner(name), event_responses(response, user_id)'

export function eventDetailOptions(eventId: string | undefined, userId: string | undefined) {
  return queryOptions({
    queryKey: eventKeys.detail(eventId ?? ''),
    enabled: Boolean(eventId) && Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<EventDetail | null> => {
      if (!eventId || !userId) return null
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_SELECT)
        .eq('id', eventId)
        .eq('event_responses.user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (data === null) return null
      const row = eventWithResponseSchema.parse(data)
      return {
        id: row.id,
        teamId: row.team_id,
        teamName: row.teams.name,
        type: row.type,
        title: row.title,
        location: row.location,
        notes: row.notes,
        startsAt: row.starts_at,
        status: row.status,
        myResponse: row.event_responses[0]?.response ?? null,
      }
    },
  })
}

/**
 * The member read. Enabled only for a signed-in caller with a valid id; `null` means the caller
 * is not a member and the screen shows the preview instead. Reads the session itself so the
 * screen stays declarative.
 */
export function useEventDetail(eventId: string | undefined): UseQueryResult<EventDetail | null> {
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined
  return useQuery(eventDetailOptions(eventId, userId))
}
