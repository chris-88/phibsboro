import * as Sentry from '@sentry/react'
import { ErrorState } from '@/components/states'
import { VersionTag } from '@/components/version-tag'

export interface AppErrorBoundaryProps {
  /** Reload reloads the document: a tree that threw during render has nothing to retry, and
   *  the honest recovery is a fresh page. Injectable because jsdom's `location.reload`
   *  cannot be spied on. */
  reload?: () => void
  children: React.ReactNode
}

/**
 * The last resort, wrapped around the router in App.tsx so it catches whatever the route-level
 * error element (S0.3) and each screen's own inline error state (D49) did not. Sentry's
 * boundary reports the error once with the component stack, then renders the crash screen.
 */
export function AppErrorBoundary({
  reload = () => {
    window.location.reload()
  },
  children,
}: AppErrorBoundaryProps): React.JSX.Element {
  return (
    <Sentry.ErrorBoundary
      fallback={(fallbackProps) => (
        <CrashScreen
          onReload={() => {
            fallbackProps.resetError()
            reload()
          }}
        />
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  )
}

/**
 * Deliberately depends on almost nothing: no shell, no router, no nav — any of those could be
 * what threw. Tokens only, so it renders correctly in either theme. The version tag stays so
 * "what version are you on?" still has an answer.
 */
function CrashScreen({ onReload }: { onReload: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(env(safe-area-inset-bottom)+1rem)] text-foreground">
      <div className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col justify-center">
        <ErrorState
          title="Something went wrong."
          body="Reload the app. If it keeps happening, tell your manager."
          retryLabel="Reload"
          retryFullWidth
          onRetry={onReload}
        />
      </div>
      <VersionTag />
    </div>
  )
}
