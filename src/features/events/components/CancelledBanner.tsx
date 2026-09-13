import { CircleAlert } from 'lucide-react'

/** Shown above the title of a cancelled event (D60, AC14). The availability write is already
 *  blocked by the D12 RLS check; this is the human-readable half. */
export function CancelledBanner(): React.JSX.Element {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
    >
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      <span>This one&apos;s off.</span>
    </div>
  )
}
