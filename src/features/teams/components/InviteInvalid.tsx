import { LinkProblem } from '@/features/auth/link-problem'

/**
 * The one dead-link screen every bad-token case renders (S2.4 AC9): an unknown, expired, revoked
 * or inactive-team token, and a join that raised `invalid_invite`, all show this and are
 * indistinguishable, so nothing can be probed (D28). No stack trace, no Sentry event.
 *
 * It is `LinkProblem` (S2.1's shared screen) with the AC9 heading, so the copy lives in one place
 * and the "Ask your manager for a new one." line and the sign-in button come for free. Rendered
 * as its own page on `/join/:token`, and inline on the event screen keeping the details above it.
 */
export function InviteInvalid(): React.JSX.Element {
  return <LinkProblem title="That link's no good." />
}
