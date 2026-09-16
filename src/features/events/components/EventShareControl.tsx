import { RemindButton } from '@/features/events/components/RemindButton'
import { ShareButton } from '@/features/events/components/ShareButton'
import type { EventActionData } from '@/features/events/schema'
import { useCurrentUser } from '@/features/auth/use-current-user'
import type { Counts } from '@/lib/counts'
import { serverNow } from '@/lib/serverClock'
import { buildMatchShareMessage, buildShareMessage } from '@/lib/shareMessage'

/**
 * The Schedule-tab share control (S5.2). Two gates:
 *
 *   AC9 — a manager of that team or an admin. Convenience only, mirroring S2.9's route guard;
 *         RLS is the enforcement layer, and there is nothing to enforce here anyway since sharing
 *         writes nothing.
 *   AC8 — never for a `cancelled` event, and never once `starts_at` has passed, judged by
 *         `serverNow()` (D48), never `Date.now()`. There is nothing useful to share about either.
 *
 * This is the **initial invite** and the **reminder** only (Chris, 2026-09-16). A match shares the
 * club-format fixture with **no squad** — the availability call-to-action so players can respond —
 * and the numbered teamsheet moved to the Squad view (the squad picker), where the side is actually
 * chosen. Training and social keep D13's availability share. The message is built during render, not
 * in the click handler, so the user gesture stays live when `navigator.share` runs (AC4).
 *
 * S5.3's "Send a reminder" sits in the same `data-slot="share"` region beneath the primary button,
 * taking the derived `Counts` the S4.3 screen holds (passed straight through, never recomputed) and
 * hiding itself when the awaiting number is absent or zero.
 */
export function EventShareControl({
  event,
  teamName,
  counts,
}: {
  event: EventActionData
  teamName: string
  counts?: Counts
}): React.JSX.Element | null {
  const account = useCurrentUser()
  const canManage = account.status === 'ready' && account.user.isManagerOf(event.team_id)
  if (!canManage) return null

  const started = new Date(event.starts_at).getTime() <= serverNow().getTime()
  if (event.status === 'cancelled' || started) return null

  // A match keeps the club fixture format but with no squad — the teamsheet is shared from the
  // Squad view. Every other type uses the plain availability share. Both end with the event link.
  const message =
    event.type === 'match' ? buildMatchShareMessage(event, teamName, []) : buildShareMessage(event)

  return (
    <div data-slot="share" className="flex flex-col gap-2">
      <ShareButton message={message} label="Share to WhatsApp" />
      <RemindButton event={event} counts={counts} />
    </div>
  )
}
