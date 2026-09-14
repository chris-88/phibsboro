/**
 * The club ground, in one place (V5, S8.4). A home match defaults its `location` to the maps link
 * below; away matches paste their own. The URL literal lives here and nowhere else — grep it.
 */
export const HOME_VENUE = {
  label: 'Bogies',
  mapsUrl: 'https://maps.app.goo.gl/SD1NJmBYwLqz8Z7M6',
} as const

const URL_RE = /^https?:\/\//i

/**
 * How a stored `location` renders. `events.location` is free text that may hold a URL (V5): a
 * `https?://` value becomes a tappable link — labelled "Bogies" for the home ground, "Open in
 * Maps" for any other link — and everything else is plain text. The one place a location turns
 * into display, the way `formatEventTime` is the one date formatter; every screen goes through it.
 */
export function locationDisplay(location: string): { href?: string; label: string } {
  const value = location.trim()
  if (URL_RE.test(value)) {
    return { href: value, label: value === HOME_VENUE.mapsUrl ? HOME_VENUE.label : 'Open in Maps' }
  }
  return { label: value }
}

/**
 * The location a match should hold when its side changes (S8.4, AC1). A home match with no
 * location defaults to the Bogies link; toggling to away (or to a non-match type) clears exactly
 * that auto-applied default so the manager pastes their own link. Any value the manager typed
 * themselves — anything that is neither empty nor the Bogies default — is left untouched, so the
 * rule is idempotent and never clobbers an override.
 */
export function locationForMatchSide(current: string, isHomeMatch: boolean): string {
  if (isHomeMatch) return current.trim() === '' ? HOME_VENUE.mapsUrl : current
  return current === HOME_VENUE.mapsUrl ? '' : current
}
