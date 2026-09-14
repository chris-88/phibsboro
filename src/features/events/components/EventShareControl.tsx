import { ShareButton } from '@/features/events/components/ShareButton'
import type { EventActionData } from '@/features/events/schema'
import { useCurrentUser } from '@/features/auth/use-current-user'
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
 */
export function EventShareControl({ event }: { event: EventActionData }): React.JSX.Element | null {
  const account = useCurrentUser()
  const canManage = account.status === 'ready' && account.user.isManagerOf(event.team_id)
  if (!canManage) return null

  const started = new Date(event.starts_at).getTime() <= serverNow().getTime()
  if (event.status === 'cancelled' || started) return null

  return (
    <div data-slot="share">
      <ShareButton message={buildShareMessage(event)} label="Share to WhatsApp" />
    </div>
  )
}
