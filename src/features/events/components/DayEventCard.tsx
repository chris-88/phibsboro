import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { UpcomingEvent } from '@/api/events'
import { Badge } from '@/components/ui/badge'
import { ResponsePill } from '@/features/availability/components/ResponsePill'
import { LocationText } from '@/features/events/components/LocationText'
import { cn } from 'cn'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

export interface DayEventCardProps {
  event: UpcomingEvent
  /** Shown only when the player is on more than one team, so a single-team player is not told which
   *  team the event is for (AC7). */
  showTeamName: boolean
  /**
   * The admin manage variant (S11.2): an admin viewing an event on a team they do not play for.
   * The row links to the manager event view rather than the player detail, and shows the
   * availability count instead of a personal `ResponsePill` — the admin is not responding. Default
   * `false`, so the player path renders exactly as before.
   */
  manage?: boolean
  /** The available-response count for the manage summary; `null` while it loads. Ignored unless
   *  `manage`. */
  availableCount?: number | null
}

/**
 * One compact row under the calendar, for the selected day (S10.2, refined per Chris's feedback
 * 2026-09-14 / V13). The day list is an overview, not a response surface: each row shows the
 * kick-off time, type, title, location and the player's current answer as a `ResponsePill`
 * (accept / decline / awaiting) — no inline YES / NO. The whole row is a `<Link>` to `/event/{id}`,
 * where the player responds or changes their answer (the soonest unanswered event also gets the
 * prominent card at the top of the home). A cancelled event is struck-through, not hidden (AC5).
 *
 * For an admin viewing a team they do not play for (`manage`, S11.2) the row is a manage surface:
 * it links to the manager event view and shows the availability count in place of the pill.
 */
export function DayEventCard({
  event,
  showTeamName,
  manage = false,
  availableCount,
}: DayEventCardProps): React.JSX.Element {
  const cancelled = event.status === 'cancelled'
  return (
    <Link
      to={manage ? paths.manageEvent(event.id) : paths.event(event.id)}
      className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="w-14 shrink-0 text-sm font-medium text-muted-foreground">
        {formatEventTime(event.startsAt, 'time')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              'truncate text-sm font-semibold',
              cancelled ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {event.title}
          </h3>
          {showTeamName && (
            <span className="shrink-0 text-xs text-muted-foreground">{event.teamName}</span>
          )}
        </div>
        <LocationText
          location={event.location}
          className="truncate text-xs text-muted-foreground"
        />
      </div>
      {cancelled ? (
        <Badge variant="destructive" className="shrink-0">
          Cancelled
        </Badge>
      ) : manage ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
          {typeof availableCount === 'number' ? `${availableCount.toString()} available` : 'Manage'}
          <ChevronRight className="size-4" aria-hidden />
        </span>
      ) : (
        <ResponsePill response={event.myResponse} />
      )}
    </Link>
  )
}
