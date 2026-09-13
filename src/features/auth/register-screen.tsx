import { useState } from 'react'
import { Navigate } from 'react-router'
import { ErrorState } from '@/components/states'
import { Skeleton } from '@/components/ui/skeleton'
import { useEventPreview } from '@/api/events'
import { useInviteLookup } from '@/api/invites'
import { nextRouteAfterAuth } from '@/features/auth/after-auth'
import { LinkProblem } from '@/features/auth/link-problem'
import { readPendingJoin } from '@/features/auth/pending-join'
import { RegisterForm } from '@/features/auth/register-form'
import { useSession } from '@/features/auth/session-context'

/**
 * The `/register` route (S2.1). It never renders a blank page or a stack trace: with no
 * pending join it is `LinkProblem`; with one it names the team from a lookup RPC (never a
 * `teams` select) and shows the three-field form. The join is read once on mount so it survives
 * a cold start (AC10). Account creation is open by construction — the anon key is public — so
 * this gate is UX on the membership the join RPC creates, never a security boundary (D37).
 */
export default function RegisterScreen(): React.JSX.Element {
  const session = useSession()
  // Read once, so killing the tab and reopening from a fresh load still names the team (AC10).
  const [join] = useState(readPendingJoin)
  // The join failed as a dead link after the account was created: keep the session, show the way
  // out (AC9). Held in state so the terminal screen survives re-renders.
  const [deadLinkAfterJoin, setDeadLinkAfterJoin] = useState(false)

  // A signed-in user who taps a join link is joined without re-authenticating (S2.4), never
  // shown a signup form; redirect with `replace` so back does not bounce here.
  const active = session.status !== 'signedIn'
  const inviteQuery = useInviteLookup(active && join?.kind === 'token' ? join.token : undefined)
  const eventQuery = useEventPreview(active && join?.kind === 'event' ? join.eventId : undefined)

  if (session.status === 'signedIn') {
    return <Navigate to={nextRouteAfterAuth()} replace />
  }

  if (deadLinkAfterJoin) {
    // The account exists and the session is live now, so home is a real destination (AC9).
    return <LinkProblem showHome />
  }

  // No token, no event id: nothing to join. The empty state of this screen (AC1).
  if (!join) {
    return <LinkProblem />
  }

  const query = join.kind === 'token' ? inviteQuery : eventQuery
  const teamName = query.data?.team_name

  if (query.isLoading) {
    return (
      <RegisterScreenShell teamName={undefined}>
        <RegisterForm
          canSubmit={false}
          onDeadLink={() => {
            setDeadLinkAfterJoin(true)
          }}
        />
      </RegisterScreenShell>
    )
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't check that link."
        onRetry={() => {
          void query.refetch()
        }}
      />
    )
  }

  // A lookup that resolved to no rows is a dead link — expired, revoked or unknown, one
  // indistinguishable state (D28). No account is created; send them for a new link.
  if (!teamName) {
    return <LinkProblem />
  }

  return (
    <RegisterScreenShell teamName={teamName}>
      <RegisterForm
        canSubmit
        onDeadLink={() => {
          setDeadLinkAfterJoin(true)
        }}
      />
    </RegisterScreenShell>
  )
}

/** The heading and the "You're joining …" line above the form. A skeleton holds the name's
 *  place while the lookup settles, so the fields do not jump when it arrives (UI states). */
function RegisterScreenShell({
  teamName,
  children,
}: {
  teamName: string | undefined
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Create your account</h1>
        {teamName === undefined ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <p className="text-sm text-muted-foreground">
            You&rsquo;re joining <span className="font-medium text-foreground">{teamName}</span>
          </p>
        )}
      </div>
      {children}
    </div>
  )
}
