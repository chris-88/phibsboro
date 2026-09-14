import { RemindButton } from '@/features/events/components/RemindButton'
import { ShareButton } from '@/features/events/components/ShareButton'
import type { EventActionData } from '@/features/events/schema'
import { useCurrentUser } from '@/features/auth/use-current-user'
import type { Counts } from '@/lib/counts'
import { serverNow } from '@/lib/serverClock'
import { buildShareMessage } from '@/lib/shareMessage'

/**
 * Decides whether the share control shows and builds its message (S5.2). Three gates:
 *
 *   AC9 — a manager of that team or an admin. Convenience only, mirroring S2.9's route guard;
 *         RLS is the enforcement layer, and there is nothing to enforce here anyway since sharing
 *         writes nothing.
 *   AC8 — never for a `cancelled` event, and never once `starts_at` has passed, judged by
 *         `serverNow()` (D48), never `Date.now()`. There is nothing useful to share about either.
 *
 * The message is built here during render, not in the click handler, so the user gesture stays
 * live when `navigator.share` runs (AC4). This story adds no query: `event` is the row the manager
 * event view already holds (D22).
 *
 * S5.3 adds the secondary "Send a reminder" control into the same `data-slot="share"` region,
 * directly beneath the primary button. It takes the derived `Counts` object the S4.3 screen holds
 * — passed straight through, never recomputed here — and hides itself when the awaiting number is
 * absent or zero. Undefined until both counts queries have data, which is why it is optional.
 */
export function EventShareControl({
  event,
  counts,
}: {
  event: EventActionData
  counts?: Counts
}): React.JSX.Element | null {
  const account = useCurrentUser()
  const canManage = account.status === 'ready' && account.user.isManagerOf(event.team_id)
  if (!canManage) return null

  const started = new Date(event.starts_at).getTime() <= serverNow().getTime()
  if (event.status === 'cancelled' || started) return null

  return (
    <div data-slot="share" className="flex flex-col gap-2">
      <ShareButton message={buildShareMessage(event)} label="Share to WhatsApp" />
      <RemindButton event={event} counts={counts} />
    </div>
  )
}
