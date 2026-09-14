import type { UpcomingEvent } from '@/api/events'
import { serverNow } from '@/lib/serverClock'
import { dublinLocalToUtcIso, utcIsoToDublinParts } from '@/lib/time'

/**
 * The pure day/month arithmetic behind the calendar home (S10.2). Everything here works on the
 * Dublin calendar, keyed by an `YYYY-MM-DD` string, so grouping and matching never touch a device
 * timezone (the month query is a Dublin boundary converted to UTC through the time helper, and a
 * day cell is matched by its calendar coordinates, not by an instant). No `formatEventTime` — that
 * is display; this is arithmetic.
 *
 * The one `new Date(y, m, d)` below builds a react-day-picker coordinate (a local-midnight Date is
 * the library's required day type). It is never converted to a stored timestamp — that path is
 * `dublinLocalToUtcIso` — so the D48 "compose wall-time through the helper" rule does not apply.
 */

/** The Dublin calendar day an instant falls on, as `YYYY-MM-DD`. */
export function dublinDayKey(iso: string): string {
  return utcIsoToDublinParts(iso).date
}

/** Today on the Dublin calendar, from the server clock (never the device clock, D48). */
export function todayDayKey(): string {
  return utcIsoToDublinParts(serverNow().toISOString()).date
}

/** The `YYYY-MM` month a day key belongs to. */
export function monthKeyOfDay(dayKey: string): string {
  return dayKey.slice(0, 7)
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** A react-day-picker day Date → its `YYYY-MM-DD` key, read off the local calendar fields the
 *  library fills a cell with (local midnight of that calendar day, in any timezone). */
export function dayKeyOfDate(date: Date): string {
  return `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** A `YYYY-MM-DD` key → the local-midnight Date react-day-picker uses for that day/month. */
export function dateOfDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** The first-of-month Date react-day-picker displays for a `YYYY-MM` (or `YYYY-MM-DD`) key. */
export function monthDate(monthKey: string): Date {
  return dateOfDayKey(`${monthKey.slice(0, 7)}-01`)
}

/**
 * The half-open UTC window `[start, end)` for a Dublin month, for the PostgREST filter. The
 * month's first day at 00:00 Dublin to the next month's first day at 00:00 Dublin, each composed
 * to a UTC instant through the one time helper so a DST month is exact.
 */
export function dublinMonthRange(monthKey: string): { startIso: string; endIso: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const year = y ?? 1970
  const month = m ?? 1
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return {
    startIso: dublinLocalToUtcIso(`${String(year)}-${pad2(month)}-01`, '00:00'),
    endIso: dublinLocalToUtcIso(`${String(nextYear)}-${pad2(nextMonth)}-01`, '00:00'),
  }
}

/** Events grouped by their Dublin day key, each group in the order it arrived (the query orders
 *  ascending by `starts_at`). */
export function groupEventsByDay(events: readonly UpcomingEvent[]): Map<string, UpcomingEvent[]> {
  const byDay = new Map<string, UpcomingEvent[]>()
  for (const event of events) {
    const key = dublinDayKey(event.startsAt)
    const group = byDay.get(key)
    if (group) group.push(event)
    else byDay.set(key, [event])
  }
  return byDay
}

/** One dot on a calendar day: its team colour, and whether the event is cancelled (hollow/grey). */
export interface DayDot {
  colour: string
  cancelled: boolean
}

/** What a busy day shows: up to three dots, then an overflow count (open question default: 3, +n).
 *  Dots keep the day's order; the overflow is every event past the third. */
export interface DaySummary {
  dots: DayDot[]
  overflow: number
}

const MAX_DOTS = 3

/** The dots and overflow for one day, colouring each event by its team (S10.1). `colourForTeam`
 *  returns the stored team colour; a cancelled event is flagged so the dot renders hollow/grey. */
export function summariseDay(
  events: readonly UpcomingEvent[],
  colourForTeam: (teamId: string) => string,
): DaySummary {
  const dots = events.slice(0, MAX_DOTS).map((e) => ({
    colour: colourForTeam(e.teamId),
    cancelled: e.status === 'cancelled',
  }))
  return { dots, overflow: Math.max(0, events.length - MAX_DOTS) }
}
