import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NextEventCardSkeleton } from '@/features/events/components/NextEventCardSkeleton'

/**
 * The calendar-home loading state (S10.2): the same next-event card skeleton on top, then a month
 * grid block, so nothing on the screen jumps when the two queries settle. No spinner.
 */
export function CalendarHomeSkeleton(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {/* NextEventCardSkeleton carries the one role="status" / aria-label="Loading"; the month
          grid below is decorative, so it stays out of the accessibility tree. */}
      <NextEventCardSkeleton />
      <Card aria-hidden="true">
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="mx-auto h-5 w-32" />
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 42 }, (_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
