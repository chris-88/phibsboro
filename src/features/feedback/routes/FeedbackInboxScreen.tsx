import { Navigate } from 'react-router'
import { useFeedbackInbox, useResolveFeedback } from '@/api/feedback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCurrentUser } from '@/features/auth/use-current-user'
import {
  FEEDBACK_CATEGORY_LABEL,
  type FeedbackInboxRow as FeedbackInboxRowData,
} from '@/features/feedback/schema'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

/**
 * The admin feedback inbox `/admin/feedback` (S12.3). Every report, open before resolved and newest
 * first, with the reporter's name and captured context, and a "Mark resolved" per open item. Read
 * only apart from the resolve; RLS returns all rows to an admin and only own rows to anyone else, so
 * the data is safe, and the route is admin-guarded (S2.9) as convenience. The four states and the
 * "Show more" paging mirror the S3.5 / S11.3 history shell.
 */
export default function FeedbackInboxScreen(): React.JSX.Element {
  const account = useCurrentUser()

  if (account.status === 'loading') {
    return (
      <div className="py-4">
        <LoadingState label="Checking access" />
      </div>
    )
  }
  if (account.status !== 'ready' || !account.user.isAdmin) {
    return <Navigate to={paths.home()} replace />
  }
  return <Inbox />
}

function Inbox(): React.JSX.Element {
  const inbox = useFeedbackInbox()
  const resolve = useResolveFeedback()

  return (
    <div className="py-4">
      <h1 className="mb-3 px-1 text-lg font-semibold text-foreground">Feedback</h1>

      {inbox.status === 'pending' && <LoadingState rows={3} label="Loading feedback" />}

      {inbox.status === 'error' && (
        <ErrorState title="Couldn't load feedback." onRetry={inbox.refetch} />
      )}

      {inbox.status === 'success' &&
        (inbox.rows.length === 0 ? (
          <EmptyState title="No feedback yet." />
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {inbox.rows.map((row) => (
                <FeedbackInboxRow
                  key={row.id}
                  row={row}
                  onResolve={() => {
                    resolve.mutate(row.id)
                  }}
                  resolving={resolve.isPending && resolve.variables === row.id}
                />
              ))}
            </ul>

            {inbox.hasNextPage &&
              (inbox.isFetchNextPageError ? (
                <div className="flex flex-col items-center gap-2 pt-3">
                  <p className="text-sm text-muted-foreground">Couldn't load more.</p>
                  <Button variant="outline" className="w-full" onClick={inbox.fetchNextPage}>
                    Try again
                  </Button>
                </div>
              ) : (
                <div className="pt-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={inbox.fetchNextPage}
                    disabled={inbox.isFetchingNextPage}
                  >
                    {inbox.isFetchingNextPage ? 'Loading…' : 'Show more'}
                  </Button>
                </div>
              ))}
          </>
        ))}
    </div>
  )
}

/** One narrowed field from the freeform `context` jsonb, or undefined when absent/not a string. */
function contextString(context: unknown, key: string): string | undefined {
  if (context === null || typeof context !== 'object') return undefined
  const value = (context as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

function FeedbackInboxRow({
  row,
  onResolve,
  resolving,
}: {
  row: FeedbackInboxRowData
  onResolve: () => void
  resolving: boolean
}): React.JSX.Element {
  const resolved = row.status === 'resolved'
  const when = formatEventTime(row.created_at, 'short')
  const route = contextString(row.context, 'route')
  const release = contextString(row.context, 'release')

  return (
    <li>
      <Card>
        <CardContent className="flex flex-col gap-2 py-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="shrink-0">
              {FEEDBACK_CATEGORY_LABEL[row.category]}
            </Badge>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {row.reporter?.name ?? 'Unknown'}
            </span>
            {resolved && (
              <Badge variant="outline" className="shrink-0">
                Resolved
              </Badge>
            )}
          </div>

          <p className="text-sm whitespace-pre-wrap text-foreground">{row.message}</p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{when}</span>
            {route !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{route}</span>
              </>
            )}
            {release !== undefined && (
              <>
                <span aria-hidden="true">·</span>
                <span>v{release}</span>
              </>
            )}
          </div>

          {!resolved && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={onResolve}
              disabled={resolving}
            >
              {resolving ? 'Resolving…' : 'Mark resolved'}
            </Button>
          )}
        </CardContent>
      </Card>
    </li>
  )
}
