import { Card, CardContent } from '@/components/ui/card'
import { CancelledBanner } from '@/features/events/components/CancelledBanner'
import { EventMeta } from '@/features/events/components/EventMeta'
import { EventRowMenu } from '@/features/events/components/EventRowMenu'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import type { EventActionData } from '@/features/events/schema'

/**
 * The manager event view's header (S4.3): type badge, title, the Dublin date line, location and
 * notes (omitted entirely when null, AC2), a "This one's off." banner for a cancelled event
 * (AC8), and a right-aligned action row. The row holds S4.2's `EventRowMenu` — the same Edit,
 * Cancel/Reinstate and Delete the `/manage` list uses (AC9) — and a `data-slot="share"` that
 * S5.2 fills. The slot ships empty; there is no dead button.
 */
export function EventHeaderCard({
  event,
  teamName,
  onDeleted,
}: {
  event: EventActionData
  teamName: string
  onDeleted: () => void
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm text-muted-foreground">{teamName}</p>
          <div className="-mt-1 -mr-1 flex items-center gap-1">
            {/* S5.2 fills this; empty on purpose (S4.3 scope). */}
            <span data-slot="share" />
            <EventRowMenu event={event} teamName={teamName} onDeleted={onDeleted} />
          </div>
        </div>

        {event.status === 'cancelled' && <CancelledBanner />}

        <div className="flex flex-col gap-2">
          <EventTypeBadge type={event.type} />
          <h2 className="text-lg leading-snug font-semibold text-foreground">{event.title}</h2>
        </div>

        <EventMeta startsAt={event.starts_at} location={event.location} notes={event.notes} />
      </CardContent>
    </Card>
  )
}
