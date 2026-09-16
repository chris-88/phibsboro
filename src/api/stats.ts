import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { z } from 'zod'
import { statsKeys } from '@/api/queryKeys'
import { callRpc } from '@/api/rpc'
import {
  attendanceStatRowSchema,
  performanceStatRowSchema,
  type AttendanceStatRow,
  type PerformanceStatRow,
} from '@/features/stats/schema'

/**
 * The Stats-tab reads (S17.5/S17.6). Both RPCs are role-aware in the DB (X6/X8): a team manager/admin
 * gets every member's row, a player only their own — so the hooks just parse and hand over the rows,
 * and the screen renders whatever it gets (one row for a player, the squad for a manager).
 */
export function useAttendanceStats(
  teamId: string | undefined,
): UseQueryResult<AttendanceStatRow[]> {
  return useQuery({
    queryKey: statsKeys.attendance(teamId ?? ''),
    enabled: teamId !== undefined,
    queryFn: async (): Promise<AttendanceStatRow[]> => {
      const rows = await callRpc('attendance_stats', { p_team_id: teamId ?? '' })
      return z.array(attendanceStatRowSchema).parse(rows)
    },
  })
}

export function usePerformanceStats(
  teamId: string | undefined,
): UseQueryResult<PerformanceStatRow[]> {
  return useQuery({
    queryKey: statsKeys.performance(teamId ?? ''),
    enabled: teamId !== undefined,
    queryFn: async (): Promise<PerformanceStatRow[]> => {
      const rows = await callRpc('performance_stats', { p_team_id: teamId ?? '' })
      return z.array(performanceStatRowSchema).parse(rows)
    },
  })
}
