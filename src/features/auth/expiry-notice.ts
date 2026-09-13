/**
 * The one-line "You've been signed out" notice on the re-entry to `/login` after a refresh failure
 * (AC10). Set by the expiry teardown, read once by the login screen, and never shown on a
 * deliberate sign-out. A module flag rather than a route param, because the teardown navigates from
 * outside the router and carries no state; a flag also means a reload does not resurrect the line.
 */
let pending = false

/** Raised by the expiry teardown only. */
export function setExpiryNotice(): void {
  pending = true
}

/** Read-and-clear. The login screen calls this once on mount (AC10). */
export function consumeExpiryNotice(): boolean {
  const value = pending
  pending = false
  return value
}
