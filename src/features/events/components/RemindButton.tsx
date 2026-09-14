import { ShareButton } from '@/features/events/components/ShareButton'
import type { EventActionData } from '@/features/events/schema'
import type { Counts } from '@/lib/counts'
import { serverNow } from '@/lib/serverClock'
import { buildReminderMessage } from '@/lib/shareMessage'

/**
 * The "Send a reminder" control (S5.3): a secondary variant of S5.2's `ShareButton` beneath the
 * primary share, carrying the D13 chase text with the outstanding count. It writes nothing.
 *
 * Rendered only when there is a trustworthy number to chase for: a scheduled, not-yet-started
 * event (`serverNow()`, never `Date.now()`, D48) whose derived `counts` is loaded and shows at
 * least one awaiting response. `counts` is the very object S4.3's "Awaiting" tile renders from,
 * passed down as a prop, so the button's message and the tile can never disagree (AC4). It is
 * `undefined` while either underlying query is still pending or has failed — no number, no button.
 *
 * The message is built here during render, so the string is ready before the tap and the user
 * gesture stays live for `navigator.share` (AC9, S5.2 AC4). The count is read straight off the
 * current `counts` prop, so a reminder tapped after a 30s refetch carries the new number.
 */
export function RemindButton({
  event,
  counts,
}: {
  event: EventActionData
  counts: Counts | undefined
}): React.JSX.Element | null {
  const open = event.status === 'scheduled' && new Date(event.starts_at) > serverNow()
  if (!open || counts === undefined || counts.awaiting < 1) return null

  return (
    <ShareButton
      variant="secondary"
      label="Send a reminder"
      message={buildReminderMessage(event, counts.awaiting)}
    />
  )
}
