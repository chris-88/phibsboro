import { Link } from 'react-router'
import { EventRowMenu } from '@/features/events/components/EventRowMenu'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import type { EventRow } from '@/features/events/schema'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

/**
 * One row of the manager's team list (S4.1): type badge, title, the short Dublin time, location,
 * and a `Cancelled` badge when the event is cancelled — badged in place, never hidden (D60). The
 * body links to the per-event screen S4.3 builds; the overflow menu (S4.2) sits alongside it, its
 * trigger outside the link so a tap on Edit does not navigate.
 */
export function EventListRow({
  event,
  teamName,
}: {
  event: EventRow
  teamName: string
}): React.JSX.Element {
  const cancelled = event.status === 'cancelled'
  return (
    <Card>
      <CardContent className="flex items-stretch p-0">
        <Link
          to={paths.manageEvent(event.id)}
          className="flex min-h-tap flex-1 flex-col gap-1.5 rounded-l-xl px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <div className="flex flex-wrap items-center gap-2">
            <EventTypeBadge type={event.type} />
            {cancelled && <Badge variant="destructive">Cancelled</Badge>}
          </div>
          <p
            className={
              cancelled
                ? 'text-base font-semibold text-muted-foreground line-through'
                : 'text-base font-semibold text-foreground'
            }
          >
            {event.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatEventTime(event.starts_at, 'short')} · {event.location}
          </p>
        </Link>
        <EventRowMenu event={event} teamName={teamName} />
      </CardContent>
    </Card>
  )
}
