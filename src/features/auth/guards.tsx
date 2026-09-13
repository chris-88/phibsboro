import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router'
import { toast } from 'sonner'
import { AppShellSkeleton } from '@/components/app-shell'
import { ErrorState } from '@/components/states'
import { useCurrentUser, useSignedInUser } from '@/features/auth/use-current-user'
import { setIntendedRoute } from '@/lib/intended-route'
import { paths } from '@/lib/paths'

/**
 * The authed gate. Applied in `src/routes.tsx` by guard level, so no route is guarded by
 * accident or left unguarded by omission. RootLayout already shows the chrome skeleton while
 * the account resolves, so under the router this rarely sees `loading`; the branch is kept for
 * a guard rendered on its own in a test.
 */
export function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  const state = useCurrentUser()
  const location = useLocation()

  if (state.status === 'loading') return <AppShellSkeleton />
  if (state.status === 'signedOut') {
    // Remember where they were headed so S2.5 can put them back after signing in (D1). The path
    // comes from the router location, so it carries no origin and no `#` (AC6).
    setIntendedRoute(location.pathname + location.search)
    return <Navigate to={paths.login()} replace />
  }
  if (state.status === 'error') {
    // A failed read is not a failed session: retry, never sign-out (the UI states table).
    return <ErrorState title="Couldn't load your account." onRetry={state.refetch} />
  }
  return <>{children}</>
}

/**
 * Manager gate. Wrapped inside `RequireAuth`, so it only ever sees a ready user. Redirect,
 * never render-then-hide: the manager screen must not render even for a frame (AC4).
 *
 * There is no per-team check here because most manager routes carry no team id. A manager of
 * team A opening an event on team B gets zero rows from the S1.3 read policy and the screen
 * shows its not-found state. That is the enforcement, and it is the database's.
 *
 * Convenience only. RLS is the enforcement layer (S1.3, proved by S1.4).
 */
export function RequireManager({ children }: { children: React.ReactNode }): React.JSX.Element {
  const user = useSignedInUser()
  const allowed = user.isManagerOfAny || user.isAdmin

  useEffect(() => {
    if (!allowed) toast("You don't manage a team.")
  }, [allowed])

  if (!allowed) return <Navigate to={paths.home()} replace />
  return <>{children}</>
}

/**
 * Admin gate. Managing a team does not grant admin: admin is a club-wide flag, not a
 * membership role (D2), so a manager who is not an admin is redirected too (AC5).
 *
 * Convenience only. RLS is the enforcement layer (S1.3, proved by S1.4).
 */
export function RequireAdmin({ children }: { children: React.ReactNode }): React.JSX.Element {
  const user = useSignedInUser()

  useEffect(() => {
    if (!user.isAdmin) toast("You don't manage a team.")
  }, [user.isAdmin])

  if (!user.isAdmin) return <Navigate to={paths.home()} replace />
  return <>{children}</>
}
