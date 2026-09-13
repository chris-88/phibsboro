import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Skeleton } from '@/components/ui/skeleton'
import { nextRouteAfterAuth } from '@/features/auth/after-auth'
import { readLastPhone } from '@/features/auth/last-phone'
import { readPendingJoin } from '@/features/auth/pending-join'
import { useSession } from '@/features/auth/session-context'
import { SignInForm } from '@/features/auth/sign-in-form'
import { paths } from '@/lib/paths'

/** The number the registration screen hands over on its duplicate-number link (S2.2 AC9). */
function phoneFromState(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const phone = (state as Record<string, unknown>).phone
  return typeof phone === 'string' ? phone : null
}

/**
 * The `/login` route (S2.2). One screen, two fields, one button. A signed-in visitor never sees
 * the form — they are redirected (AC11); while the session is still restoring the screen shows a
 * skeleton rather than flashing the form behind the restore (S2.6 owns the restore itself). The
 * bottom nav is absent, not hidden: D41's nav is built from a signed-in user's memberships, and
 * there is no session here, so there are no items to draw (AC13).
 */
export default function LoginScreen(): React.JSX.Element {
  const session = useSession()
  const location = useLocation()
  // Precedence: the number passed by the registration screen, then the last number that signed
  // in on this browser, then empty. Never a failed attempt, never the password. Read once so a
  // re-render cannot lose it (the prefill decides where focus lands).
  const [prefill] = useState(() => phoneFromState(location.state) ?? readLastPhone() ?? '')
  // A "Create account" link only makes sense when there is a team to join: without a pending
  // join, S2.1 rejects the visit, so an always-present link would be a route to a dead end.
  const [hasPendingJoin] = useState(() => readPendingJoin() !== null)

  if (session.status === 'loading') {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    )
  }

  if (session.status === 'signedIn') {
    return <Navigate to={nextRouteAfterAuth()} replace />
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
      <h1 className="text-lg font-semibold text-foreground">Sign in</h1>
      <SignInForm initialPhone={prefill} focusPassword={prefill !== ''} />
      {hasPendingJoin && (
        <p className="text-sm text-muted-foreground">
          New to the squad?{' '}
          <Link
            to={paths.register()}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Create account
          </Link>
        </p>
      )}
    </div>
  )
}
