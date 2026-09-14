import { Badge } from '@/components/ui/badge'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { TeamPicker } from '@/features/teams/components/TeamPicker'
import { useActiveTeam } from '@/features/teams/hooks/useActiveTeam'
import { useManagedTeams } from '@/features/teams/hooks/useManagedTeams'
import { useManageStore } from '@/features/teams/manageStore'

/**
 * The manage-area header (S6.3). Names the active team, and becomes the S6.3 team picker when the
 * caller manages more than one team — always a picker for an admin, even with one team, so a
 * freshly created team is one tap away (AC2, AC3). Mounted by the manage screens only once a team
 * has resolved; the screens own the loading, error and empty states, so this renders only the
 * populated header and never has to branch on `isAdmin` to pick a team's data (AC9).
 */
export function ManageHeader(): React.JSX.Element {
  const account = useCurrentUser()
  const isAdmin = account.status === 'ready' && account.user.isAdmin
  const { teams } = useManagedTeams()
  const { teamId } = useActiveTeam()
  const setSelectedTeamId = useManageStore((s) => s.setSelectedTeamId)

  const team = teams.find((t) => t.id === teamId) ?? null
  const showPicker = teams.length > 1 || isAdmin

  if (!showPicker) {
    return (
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className="truncate">{team?.name}</span>
        {team !== null && !team.active && (
          <Badge variant="secondary" className="shrink-0">
            Inactive
          </Badge>
        )}
      </h2>
    )
  }

  return <TeamPicker teams={teams} teamId={teamId ?? ''} onChange={setSelectedTeamId} />
}
