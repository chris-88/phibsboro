import { useEffect } from 'react'
import { useManagedTeams } from '@/features/teams/hooks/useManagedTeams'
import { useManageStore } from '@/features/teams/manageStore'
import type { Team } from '@/features/teams/schema'

export interface ActiveTeam {
  teamId: string | null
  team: Team | null
  /** The header is a picker only when more than one team can be managed (AC2). */
  canManageMany: boolean
  isLoading: boolean
  isError: boolean
}

/**
 * The single source of truth for which team the manage area is pointed at (S6.3). Resolution
 * order is exactly:
 *
 *   1. the persisted `selectedTeamId`, if it is still a team the caller can manage;
 *   2. otherwise the first managed team;
 *   3. otherwise `null`.
 *
 * When 1 falls through to 2 — a stored id for a team the caller can no longer see (AC6) — the
 * resolved id is written back once, guarded by an effect keyed on it so it corrects rather than
 * loops. No managed teams writes nothing.
 */
export function useActiveTeam(): ActiveTeam {
  const { teams, isLoading, isError } = useManagedTeams()
  const selectedTeamId = useManageStore((s) => s.selectedTeamId)
  const setSelectedTeamId = useManageStore((s) => s.setSelectedTeamId)

  const stored = teams.find((t) => t.id === selectedTeamId) ?? null
  const resolved = stored ?? teams[0] ?? null
  const resolvedId = resolved?.id ?? null

  useEffect(() => {
    if (resolvedId !== null && resolvedId !== selectedTeamId) {
      setSelectedTeamId(resolvedId)
    }
  }, [resolvedId, selectedTeamId, setSelectedTeamId])

  return {
    teamId: resolvedId,
    team: resolved,
    canManageMany: teams.length > 1,
    isLoading,
    isError,
  }
}
