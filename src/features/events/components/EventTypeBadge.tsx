import { Badge } from '@/components/ui/badge'
import type { EventType } from '@/features/events/schema'

/**
 * The event type rendered as a badge — Match, Training or Social (AC4). An exhaustive `switch`
 * over `EventType` with no `default`: adding a fourth type is a compile error here (the function
 * would no longer return on all paths), not a silent fall-through (AC3). Match wears the brand
 * colour, training the muted secondary, social its own `--info` token (never a hardcoded hex).
 */
export function EventTypeBadge({ type }: { type: EventType }): React.JSX.Element {
  switch (type) {
    case 'match':
      return <Badge variant="default">Match</Badge>
    case 'training':
      return <Badge variant="secondary">Training</Badge>
    case 'social':
      return (
        <Badge variant="default" className="bg-info text-info-foreground">
          Social
        </Badge>
      )
  }
}
