import { Badge } from '@/components/ui/badge'
import type { HomeAway } from '@/features/events/schema'

/**
 * The Home / Away label for a match (S8.2, V3), reused by the event detail, the manager view and
 * (later) the calendar day list. Renders nothing when there is no side set — a legacy match row
 * from before this column existed, or any non-match, passes `null` and shows no badge. Uses the
 * neutral outline variant so it reads as a qualifier beside the coloured type badge, never a
 * hardcoded hex.
 */
export function MatchIndicator({
  homeAway,
}: {
  homeAway: HomeAway | null
}): React.JSX.Element | null {
  if (homeAway === null) return null
  return (
    <Badge variant="outline" className="capitalize">
      {homeAway}
    </Badge>
  )
}
