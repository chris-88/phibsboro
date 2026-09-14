import type { UpcomingEvent } from '@/api/events'

/**
 * The event the home card shows: the first `scheduled` row (D60). The query is already ordered
 * ascending and already filtered to `starts_at > serverNow()`, so the first scheduled row is the
 * soonest one a player can still answer. A cancelled row that sorts first is skipped, not shown
 * (AC4). `null` when nothing is coming up.
 *
 * S3.2 renders `events.filter((e) => e.id !== next?.id)`, so the two screens never disagree about
 * which event is in the card. Kept in its own module — not colocated with `NextEventCard` — so a
 * non-component export does not trip `react-refresh/only-export-components`.
 */
export function pickNextEvent(events: readonly UpcomingEvent[]): UpcomingEvent | null {
  return events.find((e) => e.status === 'scheduled') ?? null
}
