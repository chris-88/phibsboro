import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { paths } from '@/lib/paths'

export interface LinkProblemProps {
  /** Overridable so a caller can lead with its own line; the default is the shared copy. */
  title?: string
  body?: string
  /** Shown when a session exists — after a signed-in join that failed, home is the way out
   *  (AC9). Omitted on the cold, signed-out path, where there is nowhere to go but sign in. */
  showHome?: boolean
}

/**
 * The shared dead-link screen: a plain line and a way forward, never a stack trace (S2.1),
 * reused by S2.3 and S2.4. Presentational only — it runs no query and no mutation, so it has no
 * loading or error state of its own; a throw while rendering it is caught by the S0.6 root
 * boundary.
 */
export function LinkProblem({
  title = "That link isn't working.",
  body = 'Ask your manager for a new one.',
  showHome = false,
}: LinkProblemProps): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-2 py-10 text-center">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <Button asChild className="w-full">
          <Link to={paths.login()}>Sign in</Link>
        </Button>
        {showHome && (
          <Button asChild variant="outline" className="w-full">
            <Link to={paths.home()}>Go to home</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
