import { Card, CardContent } from '@/components/ui/card'
import { CancelledBanner } from '@/features/events/components/CancelledBanner'
import { EventMeta } from '@/features/events/components/EventMeta'
import { EventRowMenu } from '@/features/events/components/EventRowMenu'
import { EventShareControl } from '@/features/events/components/EventShareControl'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import type { EventActionData } from '@/features/events/schema'
import type { Counts } from '@/lib/counts'

/**
 * The manager event view's header (S4.3): type badge, title, the Dublin date line, location and
 * notes (omitted entirely when null, AC2), a "This one's off." banner for a cancelled event
 * (AC8), and a right-aligned action row holding S4.2's `EventRowMenu`. S5.2 fills the
 * `data-slot="share"` beneath the meta with the full-width "Share to WhatsApp" control (moved out
 * of the icon row so a 44px full-width primary button fits at 375px, AC1); it renders nothing for
 * a player, a cancelled event or a past one (EventShareControl gates it).
 */
export function EventHeaderCard({
  event,
  teamName,
  counts,
  onDeleted,
}: {
  event: EventActionData
  teamName: string
  /** S4.3's derived counts, forwarded to the S5.3 reminder control; undefined while loading. */
  counts?: Counts
  onDeleted: () => void
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{teamName}</p>
          <div className="-mt-1 -mr-1 flex items-center gap-1">
            <EventRowMenu event={event} teamName={teamName} onDeleted={onDeleted} />
          </div>
        </div>

        {event.status === 'cancelled' && <CancelledBanner />}

        <div className="flex flex-col gap-2">
          <EventTypeBadge type={event.type} />
          <h2 className="text-lg leading-snug font-semibold text-foreground">{event.title}</h2>
        </div>

        <EventMeta startsAt={event.starts_at} location={event.location} notes={event.notes} />

        {/* Fills data-slot="share"; renders nothing for a player, a cancelled event or a past one.
            The reminder button beneath appears only when counts show at least one awaiting (S5.3). */}
        <EventShareControl event={event} counts={counts} />
      </CardContent>
    </Card>
  )
}
