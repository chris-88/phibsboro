import { Badge } from '@/components/ui/badge'
import { ATTENDANCE_LABEL, type AttendanceState } from '@/features/attendance/schema'

const VARIANT: Record<AttendanceState, 'default' | 'outline' | 'secondary'> = {
  attended: 'default',
  absent: 'outline',
  'not-recorded': 'secondary',
}

export interface AttendancePillProps {
  state: AttendanceState
  /** A cancelled past event carries "Cancelled" and no attendance pill (AC4). */
  cancelled: boolean
}

/**
 * The single pill on a S3.5 history row. Three attendance states, or "Cancelled" for a cancelled
 * event (AC3, AC4). Every variant carries its word, so the states are distinguishable without
 * relying on colour — the word is the differentiator, not the token.
 */
export function AttendancePill({ state, cancelled }: AttendancePillProps): React.JSX.Element {
  if (cancelled) return <Badge variant="secondary">Cancelled</Badge>
  return <Badge variant={VARIANT[state]}>{ATTENDANCE_LABEL[state]}</Badge>
}
