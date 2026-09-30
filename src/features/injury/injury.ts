import { formatEventTime } from '@/lib/time'

/**
 * A bare `date` ('YYYY-MM-DD', the `expected_return` column) formatted for display (S20.3). Pinned to
 * Dublin through the one `formatEventTime` via a safe noon instant, so the calendar day never shifts
 * across the timezone boundary. Yields the same "Wed 14 Oct" short style the app uses elsewhere.
 */
export function formatReturnDate(date: string): string {
  return formatEventTime(`${date}T12:00:00.000Z`, 'short')
}
