import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/paths'

export interface NotFoundProps {
  title?: string
  body?: string
  actionLabel?: string
  actionTo?: string
}

/**
 * The 404 screen, content only: the route that renders it supplies the shell. Generic on
 * purpose so S3.3 can reuse it for an event id that does not exist (D49). One action, not
 * two — a confused player should not have to choose (S0.3 open question 4).
 */
export function NotFound({
  title = 'Nothing here.',
  body = "That link doesn't point at anything.",
  actionLabel = 'Go to the app',
  actionTo = paths.home(),
}: NotFoundProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <h2 className="text-base font-medium text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      <div className="w-full max-w-xs pt-4">
        <Button asChild size="lg" className="w-full">
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
