import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The same frame, padding and button height as the populated `NextEventCard`, so nothing on the
 * screen moves vertically when the data arrives (AC13). A badge bar, a title line, two meta lines
 * and the two button blocks — no spinner.
 */
export function NextEventCardSkeleton(): React.JSX.Element {
  return (
    <Card role="status" aria-busy="true" aria-label="Loading">
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-7 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      </CardContent>
    </Card>
  )
}
