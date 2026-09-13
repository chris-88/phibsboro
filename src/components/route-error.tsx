import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { NotFound } from '@/components/not-found'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { NOT_FOUND_TITLE, useDocumentTitle } from '@/lib/document-title'
import { paths } from '@/lib/paths'
import { RouteParamMissingError } from '@/lib/use-route-param'

const ERROR_TITLE = 'Something went wrong.'

export interface RouteErrorProps {
  /** "Try again" reloads the document. A route that threw during render has no loader to
   *  revalidate, and the honest recovery for a broken chunk or a bad param is a fresh page.
   *  Injectable because jsdom's `location.reload` cannot be spied on. */
  reload?: () => void
}

/**
 * The route-level `errorElement`. A missing route param is a bad link, so it gets the 404
 * screen; anything else gets the error state with a retry and a way home (D49).
 *
 * This is a React error boundary sitting inside `AppErrorBoundary`, so it — not Sentry's
 * boundary — catches every screen that throws during render. It therefore has to report
 * (S0.6 AC5); the root boundary only ever sees what throws outside the router. A bad link
 * is not a bug and is not reported.
 */
export function RouteError({
  reload = () => {
    window.location.reload()
  },
}: RouteErrorProps): React.JSX.Element {
  const error = useRouteError()
  const notFound = error instanceof RouteParamMissingError
  useDocumentTitle(notFound ? NOT_FOUND_TITLE : ERROR_TITLE)
  useEffect(() => {
    if (notFound) return
    // Same shape Sentry's own boundary uses, so the two group alike. StrictMode re-runs this
    // in dev with the same error object; the default dedupe integration drops the repeat.
    Sentry.captureException(error, {
      mechanism: { type: 'auto.function.react.error_element', handled: true },
    })
  }, [error, notFound])

  return (
    <AppShell chrome="bare" role="player">
      {notFound ? (
        <NotFound />
      ) : (
        <>
          <ErrorState
            title={ERROR_TITLE}
            body="Try again, or go back to the app."
            onRetry={reload}
          />
          <div className="flex justify-center">
            <Button asChild variant="link">
              <Link to={paths.home()}>Go to the app</Link>
            </Button>
          </div>
        </>
      )}
    </AppShell>
  )
}
