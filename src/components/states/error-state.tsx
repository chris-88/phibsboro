import { CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  title?: string
  body?: string
  /** Defaults to "Try again". The root crash screen (S0.6) says "Reload", because that is
   *  what it does. */
  retryLabel?: string
  /** Full-width retry for the crash screen, where it is the only thing on the page. */
  retryFullWidth?: boolean
  /** Not optional. D49 forbids a blank error screen anywhere in the app, and requiring
   *  the retry here enforces that in the type rather than in review. */
  onRetry: () => void
}

export function ErrorState({
  title = 'Something went wrong.',
  body,
  retryLabel = 'Try again',
  retryFullWidth = false,
  onRetry,
}: ErrorStateProps): React.JSX.Element {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <CircleAlert className="size-6 text-destructive" aria-hidden="true" />
      <p className="text-base font-medium text-foreground">{title}</p>
      {body !== undefined && <p className="text-sm text-muted-foreground">{body}</p>}
      <div className={cn('pt-2', retryFullWidth && 'w-full')}>
        <Button
          variant={retryFullWidth ? 'default' : 'outline'}
          className={cn(retryFullWidth && 'w-full')}
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      </div>
    </div>
  )
}
