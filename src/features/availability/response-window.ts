import type { Enums } from '@/lib/db'
import { formatEventTime } from '@/lib/time'

type EventStatus = Enums<'event_status'>

/** Whether a response may be taken, and if not, why and the line to render. The single decision
 *  point (S3.4 AC13): no call site re-derives "can I respond". */
export type ResponseWindow =
  { open: true } | { open: false; reason: 'cancelled' | 'started'; message: string }

/**
 * Open or shut, decided against an injected `now` and nothing else, so the truth table is a plain
 * fixture with no clock and the copy is asserted beside the decision that produces it. Three rules,
 * in order (D12, D60, D61):
 *
 *   1. cancelled → shut, "This one's off." (D60). Cancelled beats started, so a cancelled past
 *      event reads this one line, never both (AC5).
 *   2. started → shut, "Too late now. This started {short}." The comparison is `<=` because the
 *      D12 policy is `starts_at > now()`, so the UI never offers a tap the database would refuse
 *      (AC6).
 *   3. otherwise open.
 *
 * The enforcement is the RLS `WITH CHECK` (D12, owned by S1.3, proved by S1.4); this only mirrors
 * it for feedback and adds no rule of its own.
 */
export function responseWindow(
  event: { status: EventStatus; starts_at: string },
  now: Date,
): ResponseWindow {
  if (event.status === 'cancelled') {
    return { open: false, reason: 'cancelled', message: "This one's off." }
  }
  if (Date.parse(event.starts_at) <= now.getTime()) {
    return {
      open: false,
      reason: 'started',
      message: `Too late now. This started ${formatEventTime(event.starts_at, 'short')}.`,
    }
  }
  return { open: true }
}
