import { Navigate } from 'react-router'
import { LoadingState } from '@/components/states'
import { useIsAdmin, useIsTeamManager } from '@/api/session'
import { useTeams } from '@/api/teams'
import { JoinLinkPanel } from '@/features/teams/join-link-panel'
import { paths } from '@/lib/paths'
import { useRouteParam } from '@/lib/use-route-param'

/**
 * The `/manage/team/:teamId/members` screen (S6.2). This story builds the join-link half: the
 * squad link for a manager or admin, and the admin-only manager link. S6.4 adds the member list
 * to the same screen.
 *
 * The gate is convenience only — `is_team_manager` is true for a manager of the team or any
 * admin, so a player resolves to false and is sent home rather than shown a broken screen (AC1).
 * RLS is the enforcement layer: the invite RPCs refuse a player regardless of what renders.
 */
export default function TeamMembersScreen(): React.JSX.Element {
  const teamId = useRouteParam('teamId')
  const gate = useIsTeamManager(teamId)
  const admin = useIsAdmin()
  const teams = useTeams()

  // No flash of a redirect or a disabled panel while access and the team resolve.
  if (gate.isPending || admin.isPending) {
    return (
      <div className="py-4">
        <LoadingState label="Checking access" />
      </div>
    )
  }
  if (!gate.data) return <Navigate to={paths.home()} replace />

  const isAdmin = admin.data ?? false
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
    </div>
  )
}
