import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { eventKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import type { AvailabilityResponse } from '@/features/availability/schema'
import { useSession } from '@/features/auth/session-context'
import { useSignedInUser } from '@/features/auth/use-current-user'
import {
  eventPreviewSchema,
  eventRowSchema,
  eventWithResponseSchema,
  toEventInsert,
  upcomingEventRowSchema,
  type EventFormValues,
  type EventPreview,
  type EventRow,
  type EventStatus,
  type EventType,
  type UpcomingEventRow,
} from '@/features/events/schema'
import { serverNow } from '@/lib/serverClock'
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

// —— The player's upcoming events (S3.1, and the S3.2 list) ——————————————————————

/** The flat, camelCase view of one upcoming event. The home card and the S3.2 list read it. */
export interface UpcomingEvent {
  id: string
  teamId: string
  teamName: string
  type: EventType
  title: string
  location: string
  startsAt: string
  status: EventStatus
  /** The caller's own answer, or null while awaiting. Never a teammate's (D22, D32). */
  myResponse: AvailabilityResponse | null
}

/**
 * Every upcoming event across the caller's teams, ascending, in one round trip (S3.1). Four
 * things carry weight and none is decoration:
 *
 * - `.in('team_id', teamIds)` — RLS excludes other teams, but D33 also lets a player select any
 *   event they hold a response row for, so a leaver would otherwise keep seeing that team's
 *   fixtures (AC6).
 * - `.eq('event_responses.user_id', userId)` — a manager's read policy returns the whole squad's
 *   responses through the embed; without it `event_responses[0]` is a teammate's answer. `.max(1)`
 *   on the schema fails a test if it is ever dropped (D32).
 * - `.gte('starts_at', serverNow())` — the server clock, never the device clock (D48, AC5).
 * - the second `.order('id')` — two events at the same instant would otherwise flip between
 *   refetches and the card would flicker.
 *
 * `enabled: teamIds.length > 0` means the no-memberships case fires no request; the screen reads
 * `memberships.length === 0` directly for its no-team empty state rather than inferring it.
 */
const UPCOMING_SELECT =
  'id, team_id, type, title, location, starts_at, status, teams!inner(name), event_responses(response, user_id)'

function toUpcomingEvent(row: UpcomingEventRow): UpcomingEvent {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.teams.name,
    type: row.type,
    title: row.title,
    location: row.location,
    startsAt: row.starts_at,
    status: row.status,
    myResponse: row.event_responses[0]?.response ?? null,
  }
}

export function useUpcomingEvents(): UseQueryResult<UpcomingEvent[], PostgrestError> {
  const { id: userId, memberships } = useSignedInUser()
  const teamIds = memberships.map((m) => m.teamId)
  return useQuery<UpcomingEvent[], PostgrestError>({
    queryKey: eventKeys.upcoming(userId),
    enabled: teamIds.length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(UPCOMING_SELECT)
        .in('team_id', teamIds)
        .gte('starts_at', serverNow().toISOString())
        .eq('event_responses.user_id', userId)
        .order('starts_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(50)
      if (error) throw error
      return z.array(upcomingEventRowSchema).parse(data).map(toUpcomingEvent)
    },
  })
}

// —— The manager list and the create write (S4.1) ——————————————————————————————

/**
 * Every event for one team from a cut-off sixty days back, ascending, so one query feeds both the
 * Upcoming and Past sections and the list stays bounded without pagination. PostgREST compares
 * against a literal, so the cut-off is computed here and sent as an ISO string — there is no
 * `now() - interval` to send. The window uses `serverNow()`, never the device clock (D48).
 */
export function teamEventsOptions(teamId: string | undefined) {
  return queryOptions({
    queryKey: eventKeys.list(teamId ?? ''),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<EventRow[]> => {
      if (!teamId) return []
      const cutoff = new Date(serverNow().getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('team_id', teamId)
        .gte('starts_at', cutoff)
        .order('starts_at', { ascending: true })
      if (error) throw error
      return z.array(eventRowSchema).parse(data)
    },
  })
}

export function useTeamEvents(teamId: string | undefined): UseQueryResult<EventRow[]> {
  return useQuery(teamEventsOptions(teamId))
}

/**
 * The one create write (S4.1). `created_by` is set client-side from the session uuid; the RLS
 * insert policy does not check it, so it is audit, not authorisation. The whole `eventKeys.all`
 * subtree is invalidated on success — at a squad's size, precision buys nothing and risks a stale
 * count — and the screen owns the navigate and the toast. A refusal surfaces as a raw
 * `PostgrestError`, which `eventWriteErrorMessage` maps to copy (AC9).
 */
export function useCreateEvent(): UseMutationResult<EventRow, PostgrestError, EventFormValues> {
  const qc = useQueryClient()
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined
  return useMutation<EventRow, PostgrestError, EventFormValues>({
    mutationFn: async (values) => {
      if (userId === undefined) throw new Error('not signed in')
      const { data, error } = await supabase
        .from('events')
        .insert(toEventInsert(values, userId))
        .select()
        .single()
      if (error) throw error
      return eventRowSchema.parse(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: eventKeys.all }),
  })
}

/**
 * A PostgREST refusal → one line of copy, reused by S4.2. `42501` is RLS refusing the insert,
 * which covers both an unmanaged team and an inactive one (D50); the manager's fix is the same
 * either way, so the message does not distinguish them.
 */
export function eventWriteErrorMessage(error: PostgrestError): string {
  switch (error.code) {
    case '42501':
      return "You can't add events to that team."
    case '23514':
      return "That doesn't fit. Check the title and location lengths."
    case '23503':
      return 'That team no longer exists.'
    default:
      return "Couldn't save. Try again."
  }
}
