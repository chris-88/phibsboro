import { Check, ChevronDown, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ResponsePill } from '@/features/availability/components/ResponsePill'
import type { AvailabilityResponse } from '@/features/availability/schema'
import { attendanceValue, toAttended } from '@/features/events/components/attendance-value'
import type { RosterRow } from '@/lib/roster'

export interface PlayerResponseCardProps {
  row: RosterRow
  /** Omitted in S4.4, supplied by S4.5. Absent means the control renders disabled. */
  onAttendanceChange?: (userId: string, attended: boolean | null) => void
  /** True while this row's write is in flight: the control stays visible and goes disabled. */
  saving?: boolean
  /** Set means disabled, with this line rendered under the control. S4.5 passes the cancelled-event
   *  line; S4.4 never passes it. */
  disabledReason?: string
  /** S18.1: supplied by the manager view while the event is still open, this turns the availability
   *  pill into a menu — "Mark available / unavailable" — so a manager can answer on a player's
   *  behalf. Omitted (a closed/cancelled event, or any other screen), the pill is display-only. */
  onResponseChange?: (userId: string, response: AvailabilityResponse) => void
  /** True while this row's on-behalf response write is in flight: the menu trigger goes disabled. */
  responseSaving?: boolean
}

/**
 * One squad member: name and availability on line one, a full-width three-state attendance control
 * on line two (D42). The same card serves S4.5; the attendance control is disabled here — whenever
 * `onAttendanceChange` is undefined, `saving` is true, or `disabledReason` is set. When
 * `onResponseChange` is supplied (S18.1), line one's pill becomes a menu so a manager can set the
 * player's availability on their behalf; otherwise it stays a plain pill. The pill carries an
 * aria-label so a screen reader reads the name with the state, e.g. "Dara Byrne, awaiting".
 */
export function PlayerResponseCard({
  row,
  onAttendanceChange,
  saving = false,
  disabledReason,
  onResponseChange,
  responseSaving = false,
}: PlayerResponseCardProps): React.JSX.Element {
  const disabled = onAttendanceChange === undefined || saving || disabledReason !== undefined
  const state = row.response ?? 'awaiting'

  function handleValueChange(next: string): void {
    if (onAttendanceChange === undefined) return
    // '' (Radix deselect) and 'none' both mean "not recorded" (AC3). Skip a no-op clear on a row
    // that is already not recorded so tapping the selected "Not recorded" fires nothing.
    const attended = toAttended(next)
    if (attended === row.attended) return
    onAttendanceChange(row.userId, attended)
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {row.name}
          </span>
          {onResponseChange === undefined ? (
            <ResponsePill response={row.response} aria-label={`${row.name}, ${state}`} />
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={responseSaving}
                  aria-label={`Set ${row.name}'s availability`}
                  className="inline-flex min-h-tap shrink-0 items-center gap-1 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                >
                  <ResponsePill response={row.response} aria-label={`${row.name}, ${state}`} />
                  <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={row.response === 'available'}
                  onSelect={() => {
                    onResponseChange(row.userId, 'available')
                  }}
                >
                  <Check aria-hidden="true" />
                  Mark available
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={row.response === 'unavailable'}
                  onSelect={() => {
                    onResponseChange(row.userId, 'unavailable')
                  }}
                >
                  <X aria-hidden="true" />
                  Mark unavailable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <ToggleGroup
          type="single"
          spacing={0}
          variant="outline"
          value={attendanceValue(row.attended)}
          onValueChange={handleValueChange}
          disabled={disabled}
          aria-label={`Attendance for ${row.name}`}
          className="w-full"
        >
          <ToggleGroupItem value="none" className="flex-1">
            Not recorded
          </ToggleGroupItem>
          <ToggleGroupItem value="yes" className="flex-1">
            Attended
          </ToggleGroupItem>
          <ToggleGroupItem value="no" className="flex-1">
            Absent
          </ToggleGroupItem>
        </ToggleGroup>

        {disabledReason !== undefined && (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        )}
      </CardContent>
    </Card>
  )
}
