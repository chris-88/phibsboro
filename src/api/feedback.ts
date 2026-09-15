import { useMemo } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { z } from 'zod'
import { feedbackKeys } from '@/api/queryKeys'
import { useSession } from '@/features/auth/session-context'
import {
  feedbackInboxRowSchema,
  type FeedbackContext,
  type FeedbackInboxRow,
  type FeedbackInput,
} from '@/features/feedback/schema'
import { supabase } from '@/lib/supabase'

/** One submit: the form values plus the context snapshot the screen collected (W2). */
export interface SubmitFeedbackInput {
  input: FeedbackInput
  context: FeedbackContext
}

/**
 * Send one feedback report (S12.2). Inserts a `feedback` row with `user_id` from the session — never
 * a form field — so RLS's `with check (user_id = auth.uid())` always passes and a forged reporter is
 * impossible (W2). No optimistic cache: nothing on screen reads the user's own feedback, and the
 * admin inbox refetches on its own. `PostgrestError`, matching the S4.1 table-write convention.
 */
export function useSubmitFeedback(): UseMutationResult<void, PostgrestError, SubmitFeedbackInput> {
  const session = useSession()
  const userId = session.status === 'signedIn' ? session.session.user.id : undefined

  const mutation: UseMutationResult<void, PostgrestError, SubmitFeedbackInput> = useMutation({
    mutationFn: async ({ input, context }) => {
      // The form is only reachable from a nav route, so a session is guaranteed; the guard keeps the
      // type honest rather than gating a reachable path.
      if (userId === undefined) throw new Error('not signed in')
      const { error } = await supabase.from('feedback').insert({
        user_id: userId,
        category: input.category,
        message: input.message.trim(),
        context,
      })
      if (error) throw error
    },
  })

  return mutation
}

// —— The admin inbox (S12.3) ——————————————————————————————————————————————————
// Every feedback row, newest first, the reporter's name embedded, 25 a page behind "Show more".
// RLS returns all rows only to an admin (a non-admin sees their own, so the list is safe either way,
// but the screen is admin-guarded). The FK hint is named so the embed never resolves ambiguously.

const INBOX_SELECT =
  'id, user_id, category, message, context, status, created_at, resolved_at, resolved_by, reporter:profiles!feedback_user_id_fkey(name)' as const

const PAGE_SIZE = 25

/** The shape S12.3's screen sees: pages flattened, plus the paging flags for "Show more". */
export interface FeedbackInbox {
  rows: FeedbackInboxRow[]
  status: 'pending' | 'error' | 'success'
  hasNextPage: boolean
  isFetchingNextPage: boolean
  isFetchNextPageError: boolean
  fetchNextPage: () => void
  refetch: () => void
}

/**
 * The admin feedback inbox (S12.3). Open before resolved, newest first within each — `status asc`
 * puts `open` before `resolved`, then `created_at desc`. Infinite, keyed under `feedbackKeys` so a
 * resolve invalidates only this. Parsed at the boundary so a PostgREST shape change fails here.
 */
export function useFeedbackInbox(): FeedbackInbox {
  const query = useInfiniteQuery({
    queryKey: feedbackKeys.inbox(),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<FeedbackInboxRow[]> => {
      const { data, error } = await supabase
        .from('feedback')
        .select(INBOX_SELECT)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, pageParam * PAGE_SIZE + PAGE_SIZE - 1)
      if (error) throw error
      return z.array(feedbackInboxRowSchema).parse(data)
    },
    getNextPageParam: (last, _pages, lastParam) =>
      last.length === PAGE_SIZE ? lastParam + 1 : undefined,
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

/**
 * Mark one report resolved (S12.3), through the `resolve_feedback` RPC (there is no client UPDATE
 * policy — the write is admin-guarded and stamped server-side, W2). Idempotent: resolving an
 * already-resolved row is a no-op. Invalidates the inbox on settle so the row moves.
 */
export function useResolveFeedback(): UseMutationResult<void, PostgrestError, string> {
  const qc = useQueryClient()
  const mutation: UseMutationResult<void, PostgrestError, string> = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('resolve_feedback', { p_id: id })
      if (error) throw error
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: feedbackKeys.inbox() })
    },
  })
  return mutation
}
