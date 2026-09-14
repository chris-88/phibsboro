import { dublinLocalToUtcIso, utcIsoToDublinParts } from '@/lib/time'

/**
 * The client-side twin of `generate_training_series`'s date arithmetic (S4.6). Given the first
 * session as a UTC instant and a horizon in whole weeks, it returns one UTC ISO string per week,
 * so the confirm dialog and the S4.3 list preview agree with what the function will write.
 *
 * Weeks are added to the Dublin *calendar date*, not to the instant, then each slot is composed
 * back to UTC through `dublinLocalToUtcIso`. That is what keeps 7.30pm at 7.30pm across a clock
 * change — the same move the SQL makes with `at time zone 'Europe/Dublin'`. Adding
 * `interval '7 days'` to the instant instead would shift every session after the change by an hour.
 *
 * Throws a `RangeError` outside 1..16, mirroring the function's `series_too_long` guard (D30), so
 * a bad horizon never reaches a request.
 */
export function weeklySlots(firstIso: string, weeks: number): string[] {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 16) {
    throw new RangeError(`weeklySlots: weeks must be a whole number 1..16, got ${String(weeks)}`)
  }
  const { date, time } = utcIsoToDublinParts(firstIso)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new RangeError(`weeklySlots: bad first date ${date}`)
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const slots: string[] = []
  for (let k = 0; k < weeks; k += 1) {
    // Calendar-date arithmetic in UTC so no zone offset creeps into the day count; the wall-clock
    // time is reattached by dublinLocalToUtcIso below.
    const shifted = new Date(Date.UTC(year, month - 1, day + k * 7))
    const nextDate = `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`
    slots.push(dublinLocalToUtcIso(nextDate, time))
  }
  return slots
}
