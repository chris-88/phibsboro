import { Link } from 'react-router'
import type { UpcomingEvent } from '@/api/events'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AvailabilityButtons } from '@/features/availability/components/AvailabilityButtons'
import { useResponseWindow } from '@/features/availability/use-response-window'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import { LocationText } from '@/features/events/components/LocationText'
import { cn } from 'cn'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

export interface DayEventCardProps {
  event: UpcomingEvent
  /** Shown only when the player is on more than one team, so a single-team player is not told which
   *  team the event is for (AC7). */
  showTeamName: boolean
}

/**
 * One event under the calendar, for the selected day (S10.2). The same card shape as the S3.1
 * next-event card — a `<Link>` body to `/event/{id}` with the shared YES / NO outside it (D48,
 * D61) — but keyed to a day, so it shows the kick-off time, not the full date line. The S3.4
 * response window is decided once here, so a cancelled or already-started event disables the
 * buttons with the single explanatory line, never a tap the database would refuse (AC6). A
 * cancelled event is struck-through, not hidden (AC5).
 */
export function DayEventCard({ event, showTeamName }: DayEventCardProps): React.JSX.Element {
  const cancelled = event.status === 'cancelled'
  const window = useResponseWindow({ status: event.status, starts_at: event.startsAt })
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Link
          to={paths.event(event.id)}
          className="flex flex-col gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {formatEventTime(event.startsAt, 'time')}
            </span>
            <EventTypeBadge type={event.type} />
            {cancelled && <Badge variant="destructive">Cancelled</Badge>}
            {showTeamName && (
              <span className="text-sm text-muted-foreground">{event.teamName}</span>
            )}
          </div>
          <h3
            className={cn(
              'text-lg leading-snug font-semibold',
              cancelled ? 'text-muted-foreground line-through' : 'text-foreground',
            )}
          >
            {event.title}
          </h3>
          <LocationText location={event.location} className="text-sm text-muted-foreground" />
        </Link>
        <AvailabilityButtons
          eventId={event.id}
          current={event.myResponse}
          disabled={!window.open}
          disabledReason={window.open ? undefined : window.message}
        />
      </CardContent>
    </Card>
  )
}
