/**
 * Did the user *ask* to sign out, or did a refresh token genuinely expire? GoTrue fires a single
 * `SIGNED_OUT` event for both, so the deliberate case sets this module ref immediately before
 * calling `supabase.auth.signOut()`, and the subscription reads it once to tell them apart (S2.6).
 * A ref, not React state: the reader lives in the auth subscription, above the tree, and the write
 * and read are the same tick apart.
 *
 * The two outcomes differ only in copy and where the player lands back: a deliberate sign-out
 * clears the intended route, an expiry keeps the current one so S2.5 returns them to it (AC10).
 */
let requested = false

/** Called just before `supabase.auth.signOut()`. */
export function markSignOutRequested(): void {
  requested = true
}

/** Read-and-clear: the next `SIGNED_OUT` is deliberate iff this returns true. Single use. */
export function consumeSignOutRequested(): boolean {
  const value = requested
  requested = false
  return value
}
