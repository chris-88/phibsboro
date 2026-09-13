import { Badge } from '@/components/ui/badge'
import type { EventType } from '@/features/events/schema'

/** "Match" or "Training", the two event types read as a badge (AC2). */
export function EventTypeBadge({ type }: { type: EventType }): React.JSX.Element {
  return (
    <Badge variant={type === 'match' ? 'default' : 'secondary'}>
      {type === 'match' ? 'Match' : 'Training'}
    </Badge>
  )
}
