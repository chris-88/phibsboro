import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { LoadingState } from '@/components/states'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { useTeams } from '@/api/teams'
import { JoinLinkPanel } from '@/features/teams/join-link-panel'
import { useManageStore } from '@/features/teams/manageStore'
import { MemberList } from '@/features/teams/member-list'
import { paths } from '@/lib/paths'
import { useRouteParam } from '@/lib/use-route-param'

/**
 * The `/manage/team/:teamId/members` screen. S6.2 built the join-link half: the squad link for a
 * manager or admin, and the admin-only manager link. S6.4 adds the member list below it — the
 * squad with per-member remove, change-role and correct-phone actions.
 *
 * The gate is convenience only — `isManagerOf(teamId)` is true for a manager of that team or any
 * admin, so a player resolves to false and is sent home rather than shown a broken screen (AC1).
 * RLS is the enforcement layer: the invite RPCs refuse a player regardless of what renders.
 */
export default function TeamMembersScreen(): React.JSX.Element {
  const teamId = useRouteParam('teamId')
  const account = useCurrentUser()
  const teams = useTeams()

  // The route param is the authority for this screen; the manage-area selection follows it, so the
  // header on `/manage` matches the team last administered here (S6.3).
  const setSelectedTeamId = useManageStore((s) => s.setSelectedTeamId)
  useEffect(() => {
    setSelectedTeamId(teamId)
  }, [teamId, setSelectedTeamId])

  // No flash of a redirect or a disabled panel while access and the team resolve.
  if (account.status === 'loading') {
    return (
      <div className="py-4">
        <LoadingState label="Checking access" />
      </div>
    )
  }
  // The team id is in the URL, so a per-team check is possible and belongs here (S2.9). RLS
  // refuses a mistaken caller regardless; `team_member_directory` returns zero rows too (D8).
  if (account.status !== 'ready' || !account.user.isManagerOf(teamId)) {
    return <Navigate to={paths.home()} replace />
  }

  const isAdmin = account.user.isAdmin
  const team = teams.data?.find((t) => t.id === teamId)
  // The active flag comes from the teams cache; default active until it resolves so the
  // disabled state never flickers on, and RLS refuses a mistaken create either way.
  const active = team?.active ?? true

  return (
    <div className="flex flex-col gap-4 py-4">
      {team !== undefined && (
        <header className="px-1">
          <h2 className="text-sm font-medium text-muted-foreground">{team.name}</h2>
        </header>
      )}

      <JoinLinkPanel teamId={teamId} role="player" teamActive={active} isAdmin={isAdmin} />

      {/* The manager link is a privilege grant: admin only (AC8). RLS refuses a manager too. */}
      {isAdmin && (
        <JoinLinkPanel teamId={teamId} role="manager" teamActive={active} isAdmin={isAdmin} />
      )}

      {/* The squad, below the join-link panel (S6.4). Its own four states; the panel above is
          unaffected by a members-list failure. */}
      <MemberList teamId={teamId} teamName={team?.name ?? ''} isAdmin={isAdmin} />
    </div>
  )
}
