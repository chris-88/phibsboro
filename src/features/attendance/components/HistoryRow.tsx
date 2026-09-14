import { Link } from 'react-router'
import { Card, CardContent } from '@/components/ui/card'
import { AttendancePill } from '@/features/attendance/components/AttendancePill'
import { ATTENDANCE_LABEL, type HistoryRow as HistoryRowData } from '@/features/attendance/schema'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

export interface HistoryRowProps {
  row: HistoryRowData
}

/**
 * One past event on the S3.5 history screen: a read-only Card wrapped in a Link to the event detail
 * screen (S3.3/S3.4 render its read-only past state). Line one is the title and the single
 * attendance pill, right-aligned; line two the date and the type badge. No control that writes —
 * attendance is manager-only (S4.5, AC5). `min-h-14` clears the 44px floor with two lines (AC11).
 *
 * One date, through `formatEventTime(_, 'short')` (D35, AC10). The `aria-label` carries the full
 * title, the date and the state word, so a screen reader gets the whole row even where the title
 * truncates.
 */
export function HistoryRow({ row }: HistoryRowProps): React.JSX.Element {
  const cancelled = row.status === 'cancelled'
  const when = formatEventTime(row.starts_at, 'short')
  const stateWord = cancelled ? 'Cancelled' : ATTENDANCE_LABEL[row.attendance]
  const label = `${row.title}, ${when}, ${stateWord}`

  return (
    <li>
      <Link
        to={paths.event(row.id)}
        aria-label={label}
        className="block rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Card className="min-h-14">
          <CardContent className="flex flex-col justify-center gap-1 py-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
                {row.title}
              </span>
              <AttendancePill state={row.attendance} cancelled={cancelled} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{when}</span>
              <span aria-hidden="true">·</span>
              <EventTypeBadge type={row.type} />
            </div>
          </CardContent>
        </Card>
      </Link>
    </li>
  )
}
