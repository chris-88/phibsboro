import { useAttendanceHistory } from '@/api/attendance'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { HistoryRow } from '@/features/attendance/components/HistoryRow'
import { useSignedInUser } from '@/features/auth/use-current-user'

/**
 * The player history screen `/history` (S3.5), inside the app shell and its bottom nav (D41). A flat
 * list of the player's past events, newest first, each marked Attended, Absent, Not recorded — or
 * Cancelled — and nothing on it writes: attendance is manager-only (S4.5), the player grant is
 * select-only (AC5). Rows link to the event detail screen, where the read-only past state renders.
 *
 * `useSignedInUser()` is safe here: the route is guarded `authed`. The four states — a skeleton, an
 * inline retry, the "no past events" empty, and the populated list with "Show more" — all read off
 * the one hook, which already flattened, filtered and paged (so the screen holds no paging logic).
 */
export default function HistoryScreen(): React.JSX.Element {
  const { id } = useSignedInUser()
  const history = useAttendanceHistory(id)

  return (
    <div className="py-4">
      <h1 className="sr-only">History</h1>

      {history.status === 'pending' && <LoadingState rows={3} label="Loading history" />}

      {history.status === 'error' && (
        <ErrorState title="Couldn't load your history." onRetry={history.refetch} />
      )}

      {history.status === 'success' &&
        (history.rows.length === 0 ? (
          <EmptyState title="No past events yet." />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {history.rows.map((row) => (
                <HistoryRow key={row.id} row={row} />
              ))}
            </ul>

            {history.hasNextPage &&
              (history.isFetchNextPageError ? (
                // A page-two failure keeps the rows on screen and puts the retry where "Show more"
                // was, never a blank screen (D49).
                <div className="flex flex-col items-center gap-2 pt-3">
                  <p className="text-sm text-muted-foreground">Couldn't load more.</p>
                  <Button variant="outline" className="w-full" onClick={history.fetchNextPage}>
                    Try again
                  </Button>
                </div>
              ) : (
                <div className="pt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={history.fetchNextPage}
                    disabled={history.isFetchingNextPage}
                  >
                    {history.isFetchingNextPage ? 'Loading…' : 'Show more'}
                  </Button>
                </div>
              ))}
          </>
        ))}
    </div>
  )
}
