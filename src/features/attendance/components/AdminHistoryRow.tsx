import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { AdminHistoryRow as AdminHistoryRowData } from '@/features/attendance/schema'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

export interface AdminHistoryRowProps {
  row: AdminHistoryRowData
  /** The event's team name, shown so an admin scanning every team's past events can tell them
   *  apart. `undefined` while `useTeams` loads. */
  teamName?: string
}

/**
 * One past event on the admin god-mode history screen (S11.3). Unlike the player row (S3.5) it is a
 * manage surface: it links to the MANAGER record (`paths.manageEvent`) and shows how many players
 * attended in place of a personal pill — the admin has no attendance of their own. Two lines, the
 * same Card and 44px floor as the player row; a cancelled event shows the Cancelled badge, not a
 * count. The `aria-label` carries the whole row for a screen reader where the title truncates.
 */
export function AdminHistoryRow({ row, teamName }: AdminHistoryRowProps): React.JSX.Element {
  const cancelled = row.status === 'cancelled'
  const when = formatEventTime(row.starts_at, 'short')
  const summary = cancelled ? 'Cancelled' : `${row.attendedCount.toString()} attended`
  const label =
    teamName === undefined
      ? `${row.title}, ${when}, ${summary}`
      : `${row.title}, ${teamName}, ${when}, ${summary}`

  return (
    <li>
      <Link
        to={paths.manageEvent(row.id)}
        aria-label={label}
        className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card className="min-h-14">
          <CardContent className="flex flex-col justify-center gap-1 py-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
                {row.title}
              </span>
              {cancelled ? (
                <Badge variant="destructive" className="shrink-0">
                  Cancelled
                </Badge>
              ) : (
                <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                  {row.attendedCount.toString()} attended
                  <ChevronRight className="size-4" aria-hidden />
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{when}</span>
              <span aria-hidden="true">·</span>
              <EventTypeBadge type={row.type} />
              {teamName !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{teamName}</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  )
}
