/**
 * The pure core of the manual match clock (S18.3). The four period markers are stored on the event
 * (kick-off of each half, half-time, full-time); everything the game-stats screen shows — the phase,
 * the running minute, the next button — is derived here from those markers and the current time, so
 * nothing ticking is ever stored and a reload rebuilds the exact same clock. Unit-pinned; the
 * component only wires taps to a mutation and ticks a re-render each second while a half runs.
 */

/** The four markers, camel-cased (the event columns are the snake versions). Null until tapped. */
export interface MatchClock {
  firstHalfKickoffAt: string | null
  halfTimeAt: string | null
  secondHalfKickoffAt: string | null
  fullTimeAt: string | null
}

/** The one field a clock action stamps. */
export type ClockField = keyof MatchClock

export type ClockPhase = 'pre' | 'first' | 'half-time' | 'second' | 'full'

export const PHASE_LABEL: Record<ClockPhase, string> = {
  pre: 'Not started',
  first: '1st half',
  'half-time': 'Half time',
  second: '2nd half',
  full: 'Full time',
}

/** Where the match is, read back-to-front so a later marker wins (the clock only moves forward). */
export function clockPhase(c: MatchClock): ClockPhase {
  if (c.fullTimeAt !== null) return 'full'
  if (c.secondHalfKickoffAt !== null) return 'second'
  if (c.halfTimeAt !== null) return 'half-time'
  if (c.firstHalfKickoffAt !== null) return 'first'
  return 'pre'
}

const HALF_SECONDS = 45 * 60
const at = (iso: string | null): number | null => (iso === null ? null : new Date(iso).getTime())

/**
 * The minute to show, in seconds, or null before kick-off. The 2nd half counts from 45:00 (the
 * broadcast convention), so a long first half doesn't carry a big number across the interval. The
 * running phases read `nowMs`; half-time and full-time are frozen at their stored spans.
 */
export function clockSeconds(c: MatchClock, nowMs: number): number | null {
  const t1 = at(c.firstHalfKickoffAt)
  const t2 = at(c.halfTimeAt)
  const t3 = at(c.secondHalfKickoffAt)
  const t4 = at(c.fullTimeAt)
  switch (clockPhase(c)) {
    case 'pre':
      return null
    case 'first':
      return Math.max(0, Math.floor((nowMs - (t1 ?? nowMs)) / 1000))
    case 'half-time':
      return Math.max(0, Math.floor(((t2 ?? 0) - (t1 ?? 0)) / 1000))
    case 'second':
      return HALF_SECONDS + Math.max(0, Math.floor((nowMs - (t3 ?? nowMs)) / 1000))
    case 'full':
      return HALF_SECONDS + Math.max(0, Math.floor(((t4 ?? 0) - (t3 ?? 0)) / 1000))
  }
}

/** `M:SS`. */
export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m)}:${s.toString().padStart(2, '0')}`
}

/** True while a half is actively running, so the screen knows to tick a re-render each second. */
export function clockRunning(c: MatchClock): boolean {
  const phase = clockPhase(c)
  return phase === 'first' || phase === 'second'
}

/** The next control's label and the marker it stamps with the current time. Null at full time. */
export interface ClockAction {
  label: string
  field: ClockField
}

export function nextAction(c: MatchClock): ClockAction | null {
  switch (clockPhase(c)) {
    case 'pre':
      return { label: 'Kick off', field: 'firstHalfKickoffAt' }
    case 'first':
      return { label: 'Half time', field: 'halfTimeAt' }
    case 'half-time':
      return { label: 'Kick off 2nd half', field: 'secondHalfKickoffAt' }
    case 'second':
      return { label: 'Full time', field: 'fullTimeAt' }
    case 'full':
      return null
  }
}
