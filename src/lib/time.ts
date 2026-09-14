/**
 * The one date formatter. Always Europe/Dublin, whatever the device or the CI runner is set to
 * (D35, D53). Nothing else under `src/` calls `toLocale*` or `new Intl.DateTimeFormat`; lint
 * enforces it and this is the only file exempt.
 *
 *   share  →  Saturday 14 March, 7.30pm        (+ " 2027" after the month when not this year)
 *   short  →  Sat 14 Mar, 7.30pm
 *   time   →  7.30pm                           (on the hour: 7pm; midday 12pm; midnight 12am)
 *
 * Intl supplies only the Dublin wall-clock numbers. Names come from the tables below, because
 * ICU's English data is not stable across engines ("Sep" on one, "Sept" on another) and a
 * WhatsApp message must read the same on every phone.
 */

export type EventTimeStyle = 'share' | 'short' | 'time' | 'clock24' | 'day'

const DUBLIN = 'Europe/Dublin'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

// Built once; constructing a DateTimeFormat is the expensive part.
const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: DUBLIN,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
})

interface WallClock {
  year: number
  month: number // 1–12
  day: number
  hour: number // 0–23
  minute: number
  weekday: number // 0 = Sunday, from the Dublin calendar date
}

function dublinWallClock(date: Date): WallClock {
  const fields: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {}
  for (const part of wallClock.formatToParts(date)) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value)
  }
  const year = fields.year ?? 0
  const month = fields.month ?? 0
  const day = fields.day ?? 0
  return {
    year,
    month,
    day,
    // Some engines answer "24" at midnight under hour12; h23 should not, but cost nothing to guard.
    hour: (fields.hour ?? 0) % 24,
    minute: fields.minute ?? 0,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  }
}

function clock(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'am' : 'pm'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return minute === 0
    ? `${String(h)}${suffix}`
    : `${String(h)}.${String(minute).padStart(2, '0')}${suffix}`
}

/** 24-hour "HH:MM" — how the club states match kick-off and meet times (S9.3, the club message). */
function clock24(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** The current year on a Dublin calendar, not the runner's. */
function currentDublinYear(): number {
  return dublinWallClock(new Date()).year
}

/**
 * `iso` is the string PostgREST returns for a `timestamptz` — never a `Date` assembled from
 * local parts. Throws on an unparseable string: that is a programming error, not a state.
 */
export function formatEventTime(iso: string, style: EventTimeStyle): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new RangeError(`formatEventTime: not a timestamp: ${iso}`)
  const w = dublinWallClock(date)
  const time = clock(w.hour, w.minute)
  const monthName = MONTHS[w.month - 1] ?? ''
  const dayName = DAYS[w.weekday] ?? ''

  switch (style) {
    case 'time':
      return time
    case 'clock24':
      return clock24(w.hour, w.minute)
    case 'short':
      return `${dayName.slice(0, 3)} ${String(w.day)} ${monthName.slice(0, 3)}, ${time}`
    case 'day': {
      // Date only, no time — the calendar's selected-day heading (S10.2).
      const y = w.year === currentDublinYear() ? '' : ` ${String(w.year)}`
      return `${dayName} ${String(w.day)} ${monthName}${y}`
    }
    case 'share': {
      const year = w.year === currentDublinYear() ? '' : ` ${String(w.year)}`
      return `${dayName} ${String(w.day)} ${monthName}${year}, ${time}`
    }
  }
}

// —— Dublin wall clock ⇄ UTC instant (S4.1) ——————————————————————————————————
// The inverse of formatEventTime, for the one place in the app that turns a manager's typed
// local date and time back into a UTC instant. Same Dublin calendar as above, so the two never
// disagree. Nothing else under src/ parses a naive date string or reaches for the device zone.

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Offset of Europe/Dublin at a given UTC instant, in milliseconds. Whole hours in practice
 *  (0 for GMT, +3_600_000 for IST); computed by reading the Dublin wall clock at the instant and
 *  measuring it against the instant itself, both floored to the minute so the result is exact. */
function dublinOffsetMs(utcMs: number): number {
  const w = dublinWallClock(new Date(utcMs))
  const wallMs = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute)
  const flooredUtc = Math.floor(utcMs / 60_000) * 60_000
  return wallMs - flooredUtc
}

/**
 * `"2026-03-14"` + `"19:30"` (Dublin wall clock) → `"2026-03-14T19:30:00.000Z"`.
 *
 * The naive `${date}T${time}` is parsed as if it were UTC, then shifted by the Dublin offset an
 * hour either side settles the two DST edges deterministically: a spring-gap time that does not
 * exist (01:30 on the last Sunday in March) resolves forward to 02:30 IST, and an autumn-overlap
 * time that happens twice (01:30 on the last Sunday in October) resolves to the first, summer
 * occurrence. Neither is a real training time; both are pinned so the function is testable.
 */
export function dublinLocalToUtcIso(date: string, time: string): string {
  const naive = Date.parse(`${date}T${time}:00.000Z`)
  if (Number.isNaN(naive)) throw new RangeError(`dublinLocalToUtcIso: bad input: ${date} ${time}`)
  const before = dublinOffsetMs(naive - 3_600_000)
  const after = dublinOffsetMs(naive + 3_600_000)
  // Equal offsets (the common case) collapse min and max to the one offset. A gap (offset rising
  // across the instant) takes the smaller offset and lands forward; an overlap (offset falling)
  // takes the larger and lands on the earlier, summer occurrence.
  const offset = before <= after ? Math.min(before, after) : Math.max(before, after)
  return new Date(naive - offset).toISOString()
}

/** The inverse, for populating the S4.2 edit form from a stored `starts_at`. */
export function utcIsoToDublinParts(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()))
    throw new RangeError(`utcIsoToDublinParts: not a timestamp: ${iso}`)
  const w = dublinWallClock(d)
  return {
    date: `${String(w.year)}-${pad2(w.month)}-${pad2(w.day)}`,
    time: `${pad2(w.hour)}:${pad2(w.minute)}`,
  }
}
