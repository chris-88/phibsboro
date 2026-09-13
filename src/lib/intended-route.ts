/**
 * The one place the app remembers where an unauthenticated visitor was headed, so S2.5 can
 * put them back there after they sign in. Stored under a single key as `{path, at}` from the
 * first commit, so S2.5's TTL lands as a read check rather than a format change (D1).
 *
 * This story writes and clears. S2.5 adds the route allowlist on read, the TTL, and
 * `peekIntendedRoute()`, keeping the three names shipped here.
 */
const KEY = 'pfc.intendedRoute'

/** A path we never return to after signing in: they are waypoints in the auth flow, and
 *  looping back to one is a dead end. */
const WAYPOINTS = ['/login', '/register', '/join/', '/reset/']

interface Stored {
  path: string
  at: number
}

/**
 * Remembers a path, e.g. `"/history"` or `"/event/abc?x=1"`. Callers pass
 * `location.pathname + location.search` from the router location, so there is never an origin
 * or a `#` (AC6). A waypoint is ignored. Every access is wrapped: private-mode Safari throws
 * on write, and a failure degrades to "no intended route", never to an exception.
 */
export function setIntendedRoute(path: string): void {
  if (WAYPOINTS.some((prefix) => path.startsWith(prefix))) return
  try {
    const value: Stored = { path, at: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Storage unavailable or full: there is simply no intended route.
  }
}

/** Reads, clears, and returns the path — or null when absent or malformed. Single use. */
export function takeIntendedRoute(): string | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }
  clearIntendedRoute()
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const path = (parsed as Record<string, unknown>).path
      if (typeof path === 'string') return path
    }
  } catch {
    // Malformed JSON is treated as no intended route.
  }
  return null
}

export function clearIntendedRoute(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
