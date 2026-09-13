/**
 * The last number that signed in successfully on this browser, stored so a returning player —
 * especially one bounced out of the WhatsApp webview and reopening in Safari (D47) — types a
 * password, not a number. It is the player's own number on their own phone; clearing it on
 * sign-out is a one-line change if the club ever objects (S2.2 open question 2).
 *
 * Written only after a successful sign-in, never from a failed attempt, and never the password.
 * Wrapped, so private-mode Safari's throw-on-write degrades to "no remembered number".
 */
const KEY = 'pfc.lastPhone'

export function writeLastPhone(phoneE164: string): void {
  try {
    localStorage.setItem(KEY, phoneE164)
  } catch {
    // Storage unavailable or full: there is simply no remembered number.
  }
}

export function readLastPhone(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
