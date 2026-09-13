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

export type EventTimeStyle = 'share' | 'short' | 'time'

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
    case 'short':
      return `${dayName.slice(0, 3)} ${String(w.day)} ${monthName.slice(0, 3)}, ${time}`
    case 'share': {
      const year = w.year === currentDublinYear() ? '' : ` ${String(w.year)}`
      return `${dayName} ${String(w.day)} ${monthName}${year}, ${time}`
    }
  }
}
