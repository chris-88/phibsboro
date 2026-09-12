import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export interface LoadingStateProps {
  /** How many card shapes to draw. Match the list the screen usually shows. */
  rows?: number
  /** Announced to screen readers. "Loading" unless the screen can say something better. */
  label?: string
}

/**
 * Skeleton cards in the shape of the list that is coming, not a centred spinner, so the
 * screen does not jump when the data arrives (D49).
 */
export function LoadingState({
  rows = 3,
  label = 'Loading',
}: LoadingStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
