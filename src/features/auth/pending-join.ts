import { z } from 'zod'

/**
 * The join a player is mid-way through: the invite token or the event id captured before they
 * register, and consumed after (S2.1). The capture points are S2.4 (`/join/:token`) and S3.3
 * (`/event/:id`); this store is built here, with registration, because registration is the
 * first consumer and because the join must outlive a browser restart — a player who taps a link,
 * gets pulled into the WhatsApp browser and reopens the app cold must still land in the squad
 * (D1's cold-start requirement, applied to the join as much as to the intended route).
 *
 * This is UI state about the current visit, not server data, so `localStorage` is right; it
 * never caches a row.
 */
export type PendingJoin = { kind: 'token'; token: string } | { kind: 'event'; eventId: string }

const KEY = 'pfc.pendingJoin'

/** Anything older than this is stale and ignored on read (AC11). */
const MAX_AGE_MS = 24 * 60 * 60 * 1000

const storedSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('token'), token: z.string().min(1), savedAt: z.number() }),
  z.object({ kind: z.literal('event'), eventId: z.string().min(1), savedAt: z.number() }),
])

/** Records the join with a timestamp. Wrapped, so a disabled or full store degrades to "no
 *  pending join" rather than throwing (private-mode Safari throws on write). */
export function setPendingJoin(join: PendingJoin): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...join, savedAt: Date.now() }))
  } catch {
    // Storage unavailable or full: there is simply no pending join.
  }
}

/** The current join, or null if absent, unparseable, or more than 24 hours old (AC10, AC11). */
export function readPendingJoin(): PendingJoin | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return null
  }
  if (raw === null) return null
  let parsed: z.infer<typeof storedSchema>
  try {
    parsed = storedSchema.parse(JSON.parse(raw))
  } catch {
    return null
  }
  if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null
  return parsed.kind === 'token'
    ? { kind: 'token', token: parsed.token }
    : { kind: 'event', eventId: parsed.eventId }
}

export function clearPendingJoin(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
