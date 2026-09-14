import { Skeleton } from '@/components/ui/skeleton'

/**
 * `count` skeleton rows at the same 64px height as a real `UpcomingEventRow`, so the list does not
 * shift when the shared query resolves (AC12). A meta line with a badge and pill block, and a title
 * line — no spinner. `aria-busy` marks the region for a screen reader.
 */
export function UpcomingEventRowSkeleton({ count }: { count: number }): React.JSX.Element {
  return (
    <ul role="status" aria-busy="true" aria-label="Loading events">
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex min-h-16 flex-col justify-center gap-2 border-b border-border py-3 last:border-b-0"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="ml-auto h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/5" />
        </li>
      ))}
    </ul>
  )
}
