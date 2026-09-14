import { Card, CardContent } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ResponsePill } from '@/features/availability/components/ResponsePill'
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
}

/**
 * One squad member: name and availability pill on line one, a full-width three-state attendance
 * control on line two (D42). The same card serves S4.5; the control is disabled here — whenever
 * `onAttendanceChange` is undefined, `saving` is true, or `disabledReason` is set — so S4.5 changes
 * the props passed in, never the markup. The pill carries an aria-label so a screen reader reads
 * the name with the state, e.g. "Dara Byrne, awaiting".
 */
export function PlayerResponseCard({
  row,
  onAttendanceChange,
  saving = false,
  disabledReason,
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
          <ResponsePill response={row.response} aria-label={`${row.name}, ${state}`} />
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
