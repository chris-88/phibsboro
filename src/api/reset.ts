import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { userKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import { signInWithIdentifier } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { toE164 } from '@/lib/phone'

/**
 * The client half of the reset RPCs (S2.3). A manager issues a one-time link; the player redeems
 * it to set a new password and is signed in. The client never touches `reset_tokens` — both
 * halves are security-definer functions (D9, D11), so the token is generated, stored and validated
 * in Postgres and no lookup exists (D5, D62). The token is never written to a key, a log, a URL
 * the app builds, or Sentry from this module (D16).
 */

export type ResetFailureKind = 'not_authorised' | 'invalid_token' | 'network' | 'unknown'

/**
 * An `Error` subclass — like `AuthFailure` — so it satisfies `only-throw-error` and carries as a
 * mutation error type. The raw cause is kept for Sentry and never rendered. The two literal RPC
 * strings appear only in `mapResetError`, so the two copy lines cannot drift.
 */
export class ResetFailure extends Error {
  readonly kind: ResetFailureKind

  constructor(kind: ResetFailureKind, cause?: unknown) {
    super(kind, cause === undefined ? undefined : { cause })
    this.name = 'ResetFailure'
    this.kind = kind
  }
}

/**
 * The one place the RPC's raised message becomes a typed failure. `callRpc` has already wrapped a
 * database refusal as an `AppError` whose `code` is the raised word; a bare fetch failure arrives
 * as a `TypeError` or a message the transport wrote. Everything unrecognised is `unknown`.
 */
export function mapResetError(err: unknown): ResetFailure {
  if (err instanceof ResetFailure) return err
  if (err instanceof AppError) {
    if (err.code === 'not_authorised') return new ResetFailure('not_authorised', err)
    if (err.code === 'invalid_token') return new ResetFailure('invalid_token', err)
    return new ResetFailure('unknown', err)
  }
  const message =
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { message?: unknown }).message === 'string'
      ? (err as { message: string }).message
      : ''
  if (message === 'not_authorised') return new ResetFailure('not_authorised', err)
  if (message === 'invalid_token') return new ResetFailure('invalid_token', err)
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message)) {
    return new ResetFailure('network', err)
  }
  return new ResetFailure('unknown', err)
}

/**
 * Issues a reset link through `issue_reset_token` (D10). The RPC enforces the authorisation rule
 * and raises `not_authorised` otherwise; the UI predicate `canIssueReset` only mirrors it. No
 * query invalidation — nothing the client can read changes.
 */
export function useIssueResetToken(): UseMutationResult<
  { token: string },
  ResetFailure,
  { teamId: string; userId: string }
> {
  return useMutation({
    mutationFn: async ({ teamId, userId }): Promise<{ token: string }> => {
      try {
        const token = await callRpc('issue_reset_token', { p_user_id: userId, p_team_id: teamId })
        return { token }
      } catch (err) {
        throw mapResetError(err)
      }
    },
  })
}

/**
 * Redeems a reset link (D11). The session that existed in this browser is not signed out first: if
 * the redeem fails, an unrelated user would have been signed out for nothing, and step two replaces
 * the session anyway while the server has already killed the target's other refresh tokens.
 *
 * `redeem_reset_token` returns the target's phone as full E.164 from `profiles`; it is normalised
 * through the one `toE164` before `signInWithIdentifier` (D19, D35). A redeem that succeeds but a
 * sign-in that fails still changed the password server-side, so it resolves `{ signedIn: false }`
 * and the screen finishes the player at `/login` rather than losing the change.
 */
export function useRedeemResetToken(): UseMutationResult<
  { signedIn: boolean },
  ResetFailure,
  { token: string; password: string }
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ token, password }): Promise<{ signedIn: boolean }> => {
      let phone: string
      try {
        phone = await callRpc('redeem_reset_token', { p_token: token, p_new_password: password })
      } catch (err) {
        throw mapResetError(err)
      }
      const e164 = toE164(phone)
      // The phone comes from profiles as full E.164, so this is defensive; a null would sign
      // nobody in, so it is the same dead-end as a bad token rather than a guess.
      if (e164 === null) throw new ResetFailure('invalid_token')
      try {
        await signInWithIdentifier(e164, password)
      } catch {
        return { signedIn: false }
      }
      // Force the account query to refetch under the new session's uid, whoever was signed in
      // before (AC11); the key carries no uid, so an invalidate is what swaps the identity.
      void qc.invalidateQueries({ queryKey: userKeys.current() })
      return { signedIn: true }
    },
  })
}
