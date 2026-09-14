import { Link } from 'react-router'
import type { UpcomingEvent } from '@/api/events'
import { Badge } from '@/components/ui/badge'
import { ResponsePill } from '@/features/availability/components/ResponsePill'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import { cn } from 'cn'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

export interface UpcomingEventRowProps {
  event: UpcomingEvent
  /** Shown only when the player is on more than one team, so a single-team player is not told which
   *  team an event they could only be on is for (AC7). */
  showTeamName: boolean
}

/**
 * One `<li>` of the S3.2 list, filled by a single `<Link>` so the whole 64px row is the tap target
 * (AC8). Two lines at 375px, no table (D42): line one is the date, the type badge and the status
 * pill; line two is the truncating title and, when multi-team, the team name after a middot.
 *
 * A cancelled row is marked, not hidden (D60, AC6): its title is struck and muted, a "Cancelled"
 * pill sits before the status pill, and the status pill still shows — the player's answer from
 * before the cancellation is still their answer. The `aria-label` carries the untruncated title,
 * the date and the status, so a screen reader and the accessible-name assertion both get the full
 * string even when the title truncates (AC9). One date, through `formatEventTime` (D35, AC3).
 */
export function UpcomingEventRow({
  event,
  showTeamName,
}: UpcomingEventRowProps): React.JSX.Element {
  const cancelled = event.status === 'cancelled'
  const when = formatEventTime(event.startsAt, 'short')
  const status =
    event.myResponse === 'available'
      ? 'Available'
      : event.myResponse === 'unavailable'
        ? 'Unavailable'
        : 'Awaiting'
  const label = [when, event.title, showTeamName ? event.teamName : null, status]
    .filter((part): part is string => part !== null)
    .join(', ')

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={paths.event(event.id)}
        aria-label={label}
        className="flex min-h-16 flex-col justify-center gap-1 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{when}</span>
          <EventTypeBadge type={event.type} />
          {cancelled && <Badge variant="destructive">Cancelled</Badge>}
          <ResponsePill response={event.myResponse} />
        </div>
        <div className="flex min-w-0 items-baseline gap-1">
          <span
            className={cn(
              'truncate text-base font-medium',
              cancelled ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {event.title}
          </span>
          {showTeamName && (
            <span className="shrink-0 text-sm text-muted-foreground">· {event.teamName}</span>
          )}
        </div>
      </Link>
    </li>
  )
}
