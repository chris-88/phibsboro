import { Link } from 'react-router'
import type { UpcomingEvent } from '@/api/events'
import { Card, CardContent } from '@/components/ui/card'
import { AvailabilityButtons } from '@/features/availability/components/AvailabilityButtons'
import { EventMeta } from '@/features/events/components/EventMeta'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import { paths } from '@/lib/paths'

export interface NextEventCardProps {
  event: UpcomingEvent
  /** Shown only when the player belongs to more than one team, so a single-team player is not told
   *  which team an event they could only be on is for (AC3). */
  showTeamName: boolean
}

/**
 * The one prominent card at the top of the player home (S3.1): team name (multi-team only), type
 * badge, title, date line and location, then the shared YES / NO buttons under the thumb.
 *
 * The upper block is a `<Link>` to `/event/{id}`; the buttons sit outside it, so a tap on the card
 * navigates and a tap on YES / NO answers without navigating (AC17). The buttons, the optimistic
 * write, the "You said …" line and the failure line all live in `AvailabilityButtons` and
 * `useSetResponse` (D48, D61) — this card adds none of them and passes only the current answer. No
 * date formatter is called here; `EventMeta` owns the one `formatEventTime` call (D35, AC2).
 */
export function NextEventCard({ event, showTeamName }: NextEventCardProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <Link
          to={paths.event(event.id)}
          className="flex flex-col gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {showTeamName && <p className="text-sm text-muted-foreground">{event.teamName}</p>}
          <div className="flex flex-col gap-2">
            <EventTypeBadge type={event.type} />
            <h2 className="text-xl leading-snug font-semibold text-foreground">{event.title}</h2>
          </div>
          <EventMeta startsAt={event.startsAt} location={event.location} />
        </Link>
        <AvailabilityButtons eventId={event.id} current={event.myResponse} />
      </CardContent>
    </Card>
  )
}
