import { EventMeta } from '@/features/events/components/EventMeta'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import type { EventPreview } from '@/features/events/schema'
import { Card, CardContent } from '@/components/ui/card'

export interface EventPreviewCardProps {
  preview: EventPreview
  /** The join affordance and, for an anonymous visitor, the sign-in link. Composed by the screen
   *  so the same card serves the signed-in non-member and the stranger (D49). */
  children: React.ReactNode
}

/**
 * The cold-arrival summary (D7): team name, type, title, date and location — never notes, never a
 * count. Enough to decide to join; nothing that belongs to a member.
 */
export function EventPreviewCard({ preview, children }: EventPreviewCardProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{preview.team_name}</p>
          <div className="flex flex-col gap-2">
            <EventTypeBadge type={preview.type} />
            <h2 className="text-lg leading-snug font-semibold text-foreground">{preview.title}</h2>
          </div>
          <EventMeta startsAt={preview.starts_at} location={preview.location} />
        </CardContent>
      </Card>
      {children}
    </div>
  )
}
