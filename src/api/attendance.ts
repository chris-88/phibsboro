import { useMemo } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { eventKeys, userKeys } from '@/api/queryKeys'
import { filterHistory } from '@/features/attendance/history-filter'
import {
  adminHistoryRowSchema,
  historyRowSchema,
  type AdminHistoryRow,
  type HistoryRow,
} from '@/features/attendance/schema'
import { useSession } from '@/features/auth/session-context'
import { useSignedInUser } from '@/features/auth/use-current-user'
import type { RosterAttendance } from '@/lib/roster'
import { serverNow } from '@/lib/serverClock'
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

// —— The history reads (S3.5, S11.3) ——————————————————————————————————————————
// One select against `events` with attendance embedded, newest first, 25 rows a page behind "Show
// more". Two readers share the SELECT: the player read (S3.5) filters the embed to its own row with
// `.eq('attendance.user_id', userId)` — belt-and-braces over the RLS `user_id = auth.uid()` policy,
// because an admin's read policy returns the whole squad and would blow past `.max(1)`; the admin
// read (S11.3) keeps the whole array and counts it. The FK hint is named so an ambiguous embed fails
// at build-review, not silently at runtime if a second FK is added later. No INSERT, UPDATE, UPSERT
// or DELETE lives in either read — attendance is manager-written (S4.5), the player grant read-only.

/** `attendance!attendance_event_id_fkey` names Postgres's default FK, so the embed never resolves
 *  ambiguously. The user filter lives on the reader, not baked in here, because the admin read
 *  (S11.3) deliberately wants the whole squad's rows for its count. */
export const HISTORY_SELECT =
  'id, team_id, type, title, starts_at, status, attendance!attendance_event_id_fkey(attended)' as const

const PAGE_SIZE = 25

// The cutoff is pinned into the first page param and carried through every later page, never
// recomputed: offset paging against a moving `lt` boundary would skip or duplicate a row whenever
// an event crossed into the past between pages. It never enters the query key, which would churn.

/** The shape the history screen sees: pages already flattened (and, for the player, run through
 *  `filterHistory`), plus the paging flags it renders "Show more" and the page-two error from. It
 *  holds no paging logic. Generic over the row so the player (S3.5) and admin (S11.3) reads share
 *  one screen shell. */
export interface HistoryList<Row> {
  rows: Row[]
  status: 'pending' | 'error' | 'success'
  /** Drives "Show more"; the raw page length, never the filtered length. */
  hasNextPage: boolean
  isFetchingNextPage: boolean
  /** A page-two failure keeps the rows already on screen and offers a retry where "Show more" was. */
  isFetchNextPageError: boolean
  fetchNextPage: () => void
  refetch: () => void
}

/** The player's own history (S3.5). */
export type AttendanceHistory = HistoryList<HistoryRow>

/**
 * The player's own past events, own attendance embedded (S3.5). `userId` scopes the query key so a
 * response (S3.4) or attendance (S4.5) invalidation never churns this infinite query — the key sits
 * under its own `history` prefix, outside `eventKeys.all`. A manager correcting attendance is picked
 * up on this player's next visit or focus refetch, which is soon enough. Memberships come from
 * `useSignedInUser()` (S2.9) and drive the pre-join filter; the screen is guarded `authed`, so a
 * signed-in user is guaranteed here.
 */
export function useAttendanceHistory(userId: string, enabled = true): AttendanceHistory {
  const { memberships } = useSignedInUser()

  const query = useInfiniteQuery({
    queryKey: userKeys.history(userId),
    // Disabled on the admin path so the god-mode read (`useAdminAttendanceHistory`) is the only one
    // that fires; `true` by default keeps the player path byte-for-byte unchanged.
    enabled,
    // serverNow() is the device clock until the first response records the skew; either is fine —
    // the boundary only decides whether a just-started event lands in this list or S3.2's, and no
    // write is gated on it (S3.4, by contrast, forbids the device clock). Read once, then pinned.
    initialPageParam: { page: 0, cutoffIso: serverNow().toISOString() },
    queryFn: async ({ pageParam }): Promise<HistoryRow[]> => {
      const { data, error } = await supabase
        .from('events')
        .select(HISTORY_SELECT)
        // Filter the embedded attendance to this user's own row. A player's RLS already scopes it,
        // but an admin's read policy returns EVERY squad member's attendance, which widened the
        // embed past the schema's `.max(1)` and crashed the history for admins. Filtering here makes
        // the embed the viewer's own row (0 or 1) for everyone, not just where RLS happens to.
        .eq('attendance.user_id', userId)
        .lt('starts_at', pageParam.cutoffIso)
        .order('starts_at', { ascending: false })
        .range(pageParam.page * PAGE_SIZE, pageParam.page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      // Parse at the boundary, so a PostgREST shape change fails here, not three components deep.
      return z.array(historyRowSchema).parse(data)
    },
    getNextPageParam: (last, _pages, lastParam) =>
      last.length === PAGE_SIZE
        ? { page: lastParam.page + 1, cutoffIso: lastParam.cutoffIso }
        : undefined,
  })

  // Flatten every page, then filter — never per page — so a membership boundary straddling a page
  // edge behaves the same on both sides.
  const rows = useMemo(
    () => filterHistory((query.data?.pages ?? []).flat(), memberships),
    [query.data, memberships],
  )

  return {
    rows,
    status: query.status,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    fetchNextPage: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  }
}

/**
 * Every team's past events for an admin (god mode, S11.3), the whole squad's attendance embedded so
 * each row shows how many attended. Newest first, the same 25-a-page paging as the player history.
 * RLS returns all events and all attendance to an admin (V14), so there is deliberately no
 * `.eq('attendance.user_id')` embed filter (the count needs the whole array) and no `filterHistory`
 * membership narrowing — an admin sees the club, not a team. `enabled` gates it so the player path
 * never fires this query. The key sits under the shared `history` prefix (outside `eventKeys.all`),
 * so a response or attendance write never churns it. This read never writes; it is view-only.
 */
export function useAdminAttendanceHistory(enabled: boolean): HistoryList<AdminHistoryRow> {
  const query = useInfiniteQuery({
    queryKey: userKeys.adminHistory(),
    enabled,
    initialPageParam: { page: 0, cutoffIso: serverNow().toISOString() },
    queryFn: async ({ pageParam }): Promise<AdminHistoryRow[]> => {
      const { data, error } = await supabase
        .from('events')
        .select(HISTORY_SELECT)
        .lt('starts_at', pageParam.cutoffIso)
        .order('starts_at', { ascending: false })
        .range(pageParam.page * PAGE_SIZE, pageParam.page * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return z.array(adminHistoryRowSchema).parse(data)
    },
    getNextPageParam: (last, _pages, lastParam) =>
      last.length === PAGE_SIZE
        ? { page: lastParam.page + 1, cutoffIso: lastParam.cutoffIso }
        : undefined,
  })

  const rows = useMemo(() => (query.data?.pages ?? []).flat(), [query.data])

  return {
    rows,
    status: query.status,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isFetchNextPageError: query.isFetchNextPageError,
    fetchNextPage: () => void query.fetchNextPage(),
    refetch: () => void query.refetch(),
  }
}
