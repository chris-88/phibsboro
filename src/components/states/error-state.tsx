import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ErrorStateProps {
  title?: string
  body?: string
  /** Not optional. D49 forbids a blank error screen anywhere in the app, and requiring
   *  the retry here enforces that in the type rather than in review. */
  onRetry: () => void
}

export function ErrorState({
  title = 'Something went wrong.',
  body,
  onRetry,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <CircleAlert className="size-6 text-destructive" aria-hidden="true" />
      <p className="text-base font-medium text-foreground">{title}</p>
      {body !== undefined && <p className="text-sm text-muted-foreground">{body}</p>}
      <div className="pt-2">
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}
