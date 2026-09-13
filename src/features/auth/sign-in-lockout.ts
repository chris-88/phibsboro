/**
 * The sign-in UX lockout (D36 as amended by A15). Five consecutive failed sign-ins on one
 * normalised number disable submit for 30 seconds, with a countdown. This is a courtesy that
 * stops a thumb-typo loop; it is NOT a security boundary and nothing here claims to be one. The
 * browser talks to GoTrue directly with the public anon key, so a real brute-forcer skips the
 * app entirely — what bounds that is Supabase Auth's own per-IP limits (`supabase/config.toml`)
 * and the 8-character minimum set at registration. See S2.2 and D36.
 *
 * Pure and clock-injected, so it is unit-testable without timers. State lives in `localStorage`
 * under one key as a record keyed by E.164, pruned of stale entries on read, and every access is
 * wrapped so a disabled or full store degrades to "not locked" rather than throwing.
 */
export interface LockoutState {
  failures: number
  lockedUntil: number | null
}

const KEY = 'pfc.signInLockout'
const MAX_FAILURES = 5
const LOCK_MS = 30_000
/** Entries untouched for an hour are dropped on read, so the store cannot grow unbounded. */
const PRUNE_MS = 60 * 60 * 1000

interface Entry {
  failures: number
  lockedUntil: number | null
  /** Last write time, for pruning only. */
  at: number
}
type Store = Record<string, Entry>

function readStore(): Store {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return {}
  }
  if (raw === null) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Store = {}
    for (const [phone, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue
      const v = value as Record<string, unknown>
      if (typeof v.failures !== 'number' || typeof v.at !== 'number') continue
      const lockedUntil = typeof v.lockedUntil === 'number' ? v.lockedUntil : null
      out[phone] = { failures: v.failures, lockedUntil, at: v.at }
    }
    return out
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable or full: the lockout simply does not persist. It is UX, not a boundary.
  }
}

function prune(store: Store, now: number): Store {
  const out: Store = {}
  for (const [phone, entry] of Object.entries(store)) {
    if (now - entry.at <= PRUNE_MS) out[phone] = entry
  }
  return out
}

/** Records one failed sign-in on `phoneE164` and returns the resulting state. Only an actual
 *  wrong-credentials failure calls this — a network or rate-limit failure never counts towards
 *  the five (S2.2 AC12). Once a lock window has elapsed the count restarts, so "consecutive"
 *  means within one live window. */
export function recordFailure(phoneE164: string, now: number): LockoutState {
  const store = prune(readStore(), now)
  const prev = store[phoneE164]
  const expired = prev?.lockedUntil != null && prev.lockedUntil <= now
  const base = !prev || expired ? 0 : prev.failures
  const failures = base + 1
  const lockedUntil = failures >= MAX_FAILURES ? now + LOCK_MS : null
  store[phoneE164] = { failures, lockedUntil, at: now }
  writeStore(store)
  return { failures, lockedUntil }
}

/** Clears the counter for `phoneE164` after a successful sign-in (S2.2 AC6). */
export function recordSuccess(phoneE164: string): void {
  const store = readStore()
  if (!(phoneE164 in store)) return
  const next: Store = {}
  for (const [phone, entry] of Object.entries(store)) {
    if (phone !== phoneE164) next[phone] = entry
  }
  writeStore(next)
}

/** The current state for `phoneE164`. A lock whose window has passed reads as clear, so the
 *  button re-enables without a reload (S2.2 AC6). Per-number: a different number is unaffected. */
export function checkLockout(phoneE164: string, now: number): LockoutState {
  const entry = prune(readStore(), now)[phoneE164]
  if (!entry) return { failures: 0, lockedUntil: null }
  if (entry.lockedUntil != null && entry.lockedUntil <= now) {
    return { failures: 0, lockedUntil: null }
  }
  return { failures: entry.failures, lockedUntil: entry.lockedUntil }
}
