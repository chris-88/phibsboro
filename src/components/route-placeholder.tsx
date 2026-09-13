import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export interface RoutePlaceholderProps {
  /** The story that replaces this screen, e.g. "S3.1". Printed on screen so a placeholder
   *  cannot ship to production unnoticed (S0.3 AC15). */
  story: string
  name: string
  /** A route segment worth showing, so a deep link visibly resolved to the right thing. */
  detail?: string
}

/** Ugly by design. A placeholder that looks finished is a placeholder that ships. */
export function RoutePlaceholder({
  story,
  name,
  detail,
}: RoutePlaceholderProps): React.JSX.Element {
  return (
    <Card data-testid="route-placeholder" data-story={story} className="my-6 border-dashed">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{story}</Badge>
          <span className="text-base font-medium">{name}</span>
        </div>
        {detail !== undefined && (
          <p className="font-mono text-xs break-all text-muted-foreground">{detail}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Placeholder. Story {story} builds this screen.
        </p>
      </CardContent>
    </Card>
  )
}
