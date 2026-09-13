import { QueryClient } from '@tanstack/react-query'
import { AppError } from '@/lib/errors'

/**
 * Polling and optimistic-update friendly defaults (D23, D48): no Realtime, a short stale
 * window, refetch on focus. An `AppError` is a decision the database has already made, so it
 * is never retried; a network failure gets two more goes.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, error) => !(error instanceof AppError) && count < 2,
    },
    mutations: { retry: 0 },
  },
})
