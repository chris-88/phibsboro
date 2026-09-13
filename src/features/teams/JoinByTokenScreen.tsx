import { Link, useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useInviteLookup } from '@/api/invites'
import { useJoinTeamByToken } from '@/api/joins'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { nextRouteAfterAuth } from '@/features/auth/after-auth'
import { setPendingJoin } from '@/features/auth/pending-join'
import { useSession } from '@/features/auth/session-context'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { InviteInvalid } from '@/features/teams/components/InviteInvalid'
import { JoinTeamPanel } from '@/features/teams/components/JoinTeamPanel'
import { classifyJoinError } from '@/features/teams/joinErrors'
import type { TeamInviteLookup } from '@/features/teams/schema'
import { paths } from '@/lib/paths'
import { useRouteParam } from '@/lib/use-route-param'

/** The full-screen "Checking your link…" state (nav hidden by the route's `bare` chrome, D41). */
function Checking(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Checking your link"
      className="flex flex-col items-center gap-3 px-4 py-16 text-center"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">Checking your link…</p>
    </div>
  )
}

/**
 * `/join/:token` (S2.4). A player handed the squad link in WhatsApp lands here: the team name
 * comes from `lookup_team_invite` before any session (AC1), never a `teams` select (D8). Signed
 * out, one deliberate tap writes `pfc.pendingJoin` and leaves for register or sign-in; signed in
 * and not yet a member, one tap joins through the RPC; already a member, the joined state, no RPC
 * (AC20). Every bad-token case is one indistinguishable `InviteInvalid` (AC9).
 */
export default function JoinByTokenScreen(): React.JSX.Element {
  const token = useRouteParam('token')
  const session = useSession()
  const currentUser = useCurrentUser()
  const lookup = useInviteLookup(token)
  const join = useJoinTeamByToken()
  const navigate = useNavigate()

  if (lookup.isLoading) return <Checking />

  if (lookup.isError) {
    return (
      <ErrorState
        title="Couldn't check that link."
        onRetry={() => {
          void lookup.refetch()
        }}
      />
    )
  }

  // Zero rows is the only dead-link state: unknown, expired, revoked or inactive team, one and
  // the same by design (D28).
  const invite = lookup.data
  if (!invite) return <InviteInvalid />

  // A join that raised `invalid_invite` — the live link was revoked between the lookup and the tap
  // — is the same dead-link screen (AC9).
  if (join.isError && classifyJoinError(join.error) === 'invalid') return <InviteInvalid />

  // Convenience only; the RPC is idempotent regardless (D26). Wait for the account to resolve so
  // the Join button never flashes before the already-a-member state.
  if (session.status === 'signedIn' && currentUser.status === 'loading') return <Checking />
  const alreadyMember =
    currentUser.status === 'ready' &&
    currentUser.user.memberships.some((m) => m.teamId === invite.team_id)

  if (alreadyMember) {
    return (
      <JoinCard invite={invite}>
        <p className="text-sm text-muted-foreground">
          You&rsquo;re already in,{' '}
          <span className="font-medium text-foreground">{invite.team_name}</span>.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link to={paths.home()}>Go to home</Link>
        </Button>
      </JoinCard>
    )
  }

  if (session.status === 'signedIn') {
    return (
      <JoinCard invite={invite}>
        <JoinTeamPanel
          teamName={invite.team_name}
          pending={join.isPending}
          failure={join.isError ? classifyJoinError(join.error) : null}
          onJoin={() => {
            join.mutate(token, {
              onSuccess: () => {
                void navigate(nextRouteAfterAuth(), { replace: true })
              },
            })
          }}
        />
      </JoinCard>
    )
  }

  // Signed out: both exits write the pending join first, so it survives the register-or-sign-in
  // detour and a cold start (AC2, AC3, AC4).
  const leaveFor = (path: string): void => {
    setPendingJoin({ kind: 'token', token })
    void navigate(path)
  }
  return (
    <JoinCard invite={invite}>
      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => {
            leaveFor(paths.register())
          }}
        >
          Join {invite.team_name}
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            leaveFor(paths.login())
          }}
        >
          I already have an account
        </Button>
      </div>
    </JoinCard>
  )
}

/** The team-name card every populated state shares: the name from the lookup, and the manager
 *  line only when the invite grants manager (open question 2's default). */
function JoinCard({
  invite,
  children,
}: {
  invite: TeamInviteLookup
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">{invite.team_name}</h1>
        {invite.role === 'manager' && (
          <p className="text-sm text-muted-foreground">You&rsquo;ll join as a manager.</p>
        )}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3">{children}</CardContent>
      </Card>
    </div>
  )
}
