import { AppError } from '@/lib/errors'

/**
 * A join RPC fails one of two ways, and the screen treats them differently (S2.4). A dead link —
 * unknown, expired, revoked or an inactive team, all one opaque `invalid_invite` (D28) — is
 * terminal: show `InviteInvalid`, clear `pfc.pendingJoin`, never retry. Anything else is a
 * transient failure between two servers: keep the key, offer a retry, the join is idempotent (D26).
 *
 * The token is never put in a message body here, so the D16 scrubber that truncates the join and
 * reset paths has nothing to catch (D62): an `'invalid'` is not reported to Sentry at all, and a
 * `'network'` is a breadcrumb only.
 */
export type JoinFailure = 'invalid' | 'network'

export function classifyJoinError(e: unknown): JoinFailure {
  return e instanceof AppError && e.code === 'invalid_invite' ? 'invalid' : 'network'
}
