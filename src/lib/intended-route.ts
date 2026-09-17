import { matchRoutes, type RouteObject } from 'react-router'

/**
 * The one place the app remembers where an unauthenticated visitor was headed, so the deep-link
 * return path can put them back there after they sign in (S2.5). Stored under a single key as
 * `{path, at}`: S2.9 shipped the envelope and the three names, and S2.5 adds the route allowlist,
 * the 60-minute TTL, `peekIntendedRoute()`, and the in-memory fallback, keeping those names.
 *
 * The value is a hash path only, e.g. `/event/9f1c…`. Never an absolute URL, never the origin,
 * never the leading `#` (AC4) — the two writers (the S2.9 guard and the S3.3 affordances) both
 * hand it a router `location.pathname + location.search`, which already has that shape.
 */
const KEY = 'pfc.intendedRoute'

/** A stored route older than this is stale and discarded on read (AC11): long enough for a
 *  player to be interrupted mid-registration, short enough that next week's launch of the
 *  installed app never reopens last week's event. One place, per the open question's default. */
const TTL_MS = 60 * 60 * 1000

/**
 * The S0.3 route patterns that are real destinations (D34). Waypoints — `/login`, `/register`,
 * `/join/:token`, `/reset/:token` — and the catch-all `*` are deliberately absent, so a stored
 * waypoint matches nothing here and is rejected (AC9), and so is anything that reaches only the
 * 404 (AC10). Kept in sync with `routeTable` in `src/routes.tsx` by a drift test rather than a
 * runtime import, which would form a cycle (`routes` → `guards` → this file). Data only.
 */
export const RESTORABLE_PATTERNS: readonly string[] = [
  '/',
  '/event/:id',
  '/manage',
  '/manage/event/new',
  '/manage/event/:id',
  '/manage/team/:teamId/members',
  '/squad',
  '/squad/event/:id',
  '/squad/game-stats/:id',
  '/admin',
  '/admin/feedback',
  '/admin/users',
  '/admin/subs',
  '/profile',
  '/stats',
]

const RESTORABLE_ROUTES: RouteObject[] = RESTORABLE_PATTERNS.map((path) => ({ path }))

interface Stored {
  path: string
  at: number
}

/** Survives navigation within the tab but not a cold start. Used only when `localStorage` throws
 *  — iOS private mode throws on write — so the flow still works inside the one tab (AC16). */
let memory: Stored | null = null

/**
 * True only for a path that is a single-slashed hash path matching one of the S0.3 destinations.
 * Applied on write and on read, so an attacker who can write `localStorage` cannot turn this into
 * an open redirect (AC10). Exported for its own tests and the drift guard.
 */
export function isRestorableRoute(path: string): boolean {
  if (typeof path !== 'string') return false
  if (path.length === 0 || path.length > 512) return false
  if (!path.startsWith('/')) return false // must be a same-origin absolute path
  if (path.startsWith('//')) return false // protocol-relative "//evil.com"
  if (path.includes('://') || path.includes('\\')) return false
  // Match on the pathname alone; a query string is allowed through but is not part of the route.
  const pathname = path.split(/[?#]/, 1)[0] ?? path
  const matches = matchRoutes(RESTORABLE_ROUTES, pathname)
  return matches !== null && matches.length > 0
}

function writeStore(value: Stored): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
    // localStorage is authoritative when it works; drop any stale in-memory copy.
    memory = null
  } catch {
    // Storage unavailable or full (private-mode Safari): keep it in the tab instead.
    memory = value
  }
}

function readStore(): Stored | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return memory
  }
  // Absent in localStorage: fall back to the in-tab copy, non-null only after a throwing write.
  if (raw === null) return memory
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      const { path, at } = parsed as Record<string, unknown>
      if (typeof path === 'string' && typeof at === 'number') return { path, at }
    }
  } catch {
    // Malformed JSON is treated as no intended route.
  }
  return null
}

/** Validates the envelope against the TTL and the allowlist. Null when stale, invalid or denied. */
function validate(stored: Stored | null): string | null {
  if (stored === null) return null
  if (Date.now() - stored.at > TTL_MS) return null
  if (!isRestorableRoute(stored.path)) return null
  return stored.path
}

/**
 * Remembers a path, e.g. `/history` or `/event/abc?x=1`. A non-restorable path — a waypoint, an
 * off-origin URL, an over-long string — is silently ignored, so a bad value never reaches storage
 * (AC9, AC10). Every access is wrapped: a throwing write degrades to the in-memory copy, never to
 * an exception (AC16).
 */
export function setIntendedRoute(path: string): void {
  if (!isRestorableRoute(path)) return
  writeStore({ path, at: Date.now() })
}

/** Reads, validates, clears, returns. Null when absent, stale, invalid or denied. Single use:
 *  a second call returns null (AC8), which is what stops the warm and cold consumers from both
 *  navigating — whichever reads first wins and the other gets null. */
export function takeIntendedRoute(): string | null {
  const result = validate(readStore())
  clearIntendedRoute()
  return result
}

/** Same validation, without clearing. For the boot gate deciding whether it has a route to wait
 *  for; it never consumes, so the one consumer stays `takeIntendedRoute`. */
export function peekIntendedRoute(): string | null {
  return validate(readStore())
}

export function clearIntendedRoute(): void {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
