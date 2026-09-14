import type { UpcomingEvent } from '@/api/events'

/**
 * The event the home card shows: the soonest `scheduled` event the player has **not yet answered**
 * (V13, Chris's feedback 2026-09-14). The card is a call to action, so once a player says yes or no
 * it hides and the next unanswered event takes its place; when everything upcoming is answered the
 * card disappears entirely and the calendar rises to the top. The query is ordered ascending and
 * filtered to `starts_at > serverNow()`, so the first scheduled + awaiting row is the soonest one
 * still needing an answer; a cancelled row is skipped (AC4). `null` when nothing is awaiting.
 *
 * Kept in its own module — not colocated with `NextEventCard` — so a non-component export does not
 * trip `react-refresh/only-export-components`.
 */
export function pickNextEvent(events: readonly UpcomingEvent[]): UpcomingEvent | null {
  return events.find((e) => e.status === 'scheduled' && e.myResponse === null) ?? null
}
