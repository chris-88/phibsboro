import { useMemo } from 'react'
import { useAdminAttendanceHistory, useAttendanceHistory } from '@/api/attendance'
import { useTeams } from '@/api/teams'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { AdminHistoryRow } from '@/features/attendance/components/AdminHistoryRow'
import { HistoryRow } from '@/features/attendance/components/HistoryRow'
import { useSignedInUser } from '@/features/auth/use-current-user'

/**
 * The history screen `/history`, inside the app shell and its bottom nav (D41).
 *
 * A player (S3.5) sees a flat list of their own past events, newest first, each marked Attended,
 * Absent, Not recorded or Cancelled, linking to the read-only event detail. Nothing here writes —
 * attendance is manager-only (S4.5), the player grant is select-only (AC5).
 *
 * An admin (god mode, S11.3) sees every team's past events instead, each showing how many attended
 * and tapping through to the MANAGER record. Both hooks are called so the rules of hooks hold; the
 * inactive one is `enabled: false` and never fetches, so the player path is byte-for-byte
 * unchanged. The four states — skeleton, inline retry, empty, and the populated list with "Show
 * more" — read off whichever hook is active.
 */
export default function HistoryScreen(): React.JSX.Element {
  const { id, isAdmin } = useSignedInUser()
  const player = useAttendanceHistory(id, !isAdmin)
  const admin = useAdminAttendanceHistory(isAdmin)
  const teams = useTeams()
  const history = isAdmin ? admin : player

  // Resolve a team's name for the admin rows (which span every team); a no-op for the player, whose
  // rows never show it. `undefined` until `useTeams` loads.
  const teamNameFor = useMemo(() => {
    const byId = new Map((teams.data ?? []).map((t) => [t.id, t.name]))
    return (teamId: string): string | undefined => byId.get(teamId)
  }, [teams.data])

  return (
    <div className="py-4">
      <h1 className="sr-only">History</h1>

      {history.status === 'pending' && <LoadingState rows={3} label="Loading history" />}

      {history.status === 'error' && (
        <ErrorState
          title={isAdmin ? "Couldn't load history." : "Couldn't load your history."}
          onRetry={history.refetch}
        />
      )}

      {history.status === 'success' &&
        (history.rows.length === 0 ? (
          <EmptyState title="No past events yet." />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {isAdmin
                ? admin.rows.map((row) => (
                    <AdminHistoryRow key={row.id} row={row} teamName={teamNameFor(row.team_id)} />
                  ))
                : player.rows.map((row) => <HistoryRow key={row.id} row={row} />)}
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
