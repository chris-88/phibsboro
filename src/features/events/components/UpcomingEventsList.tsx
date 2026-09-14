import type { UseQueryResult } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import type { UpcomingEvent } from '@/api/events'
import { UpcomingEventRow } from '@/features/events/components/UpcomingEventRow'
import { UpcomingEventRowSkeleton } from '@/features/events/components/UpcomingEventRowSkeleton'

export interface UpcomingEventsListProps {
  /** The shared query S3.1's screen already holds. Passed, not re-called: two components deciding
   *  independently which event is "next" is how the same fixture renders twice (DoD). */
  query: UseQueryResult<UpcomingEvent[], PostgrestError>
  /** The card's event id, so the list shows every other upcoming event and no fixture appears twice
   *  on the screen (AC1). `null` when the card holds nothing, which switches the empty copy. */
  excludeEventId: string | null
  /** True when the player is on more than one team; forwarded to every row (AC7). */
  showTeamName: boolean
}

/**
 * The chronological list under the next-event card (S3.2): every upcoming event across the player's
 * teams except the one already in the card, each row carrying its date, type, own-status pill and,
 * when multi-team, the team name. A cancelled fixture is shown marked, not hidden (D60).
 *
 * Four subordinate branches, not a screen of its own — S3.1 owns the screen-level error and the
 * no-events empty state, so this region defers to them (AC11, AC13). The one derivation is the
 * filter; ordering, the horizon, the team filter and the own-response filter are all already applied
 * by the shared query (S3.1). The heading is rendered only in the populated branch, since an empty
 * or errored region has nothing to head.
 */
export function UpcomingEventsList({
  query,
  excludeEventId,
  showTeamName,
}: UpcomingEventsListProps): React.JSX.Element | null {
  if (query.isPending) return <UpcomingEventRowSkeleton count={3} />
  if (query.isError) return null // S3.1 renders the failure once (AC13).

  const rows = query.data.filter((e) => e.id !== excludeEventId)
  if (rows.length === 0) {
    // No card and nothing here → S3.1's screen empty state owns it (AC11). A card but nothing after
    // it → this line (AC10).
    return excludeEventId === null ? null : (
      <p className="py-4 text-sm text-muted-foreground">Nothing else coming up.</p>
    )
  }

  return (
    <section aria-labelledby="also-coming-up" className="mt-4">
      <h2 id="also-coming-up" className="px-1 pb-1 text-sm font-medium text-muted-foreground">
        Also coming up
      </h2>
      <ul className="border-t border-border">
        {rows.map((event) => (
          <UpcomingEventRow key={event.id} event={event} showTeamName={showTeamName} />
        ))}
      </ul>
    </section>
  )
}
