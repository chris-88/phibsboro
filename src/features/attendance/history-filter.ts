import type { HistoryRow } from '@/features/attendance/schema'
import type { TeamMembership } from '@/features/auth/use-current-user'

/**
 * Which of the past events the read returned are actually this player's (S3.5). The `events`
 * player read policy grants every event on every team they currently belong to, including events
 * from before they joined, so someone joining in March would otherwise open History and find the
 * previous September onwards, all "Not recorded".
 *
 * Keep a row when it carries a recorded result, **or** when the player holds a membership of that
 * team whose `joinedAt` is at or before the event. A row on a team the player has left has no
 * membership and survives on its recorded result alone — the D33 retention promise, AC7.
 *
 * Pure: instants are compared as epoch milliseconds, never as lexicographic strings, so a `joinedAt`
 * and a `starts_at` written with different offsets still compare chronologically. Runs after paging
 * (over the flattened pages, never per page), so a page may render fewer than 25 rows; "Show more"
 * is driven by the raw page length, so the player never faces a dead button with rows behind it.
 */
export function filterHistory(
  rows: readonly HistoryRow[],
  memberships: readonly TeamMembership[],
): HistoryRow[] {
  return rows.filter((row) => {
    if (row.attendance !== 'not-recorded') return true
    const startedAt = new Date(row.starts_at).getTime()
    return memberships.some(
      (m) => m.teamId === row.team_id && new Date(m.joinedAt).getTime() <= startedAt,
    )
  })
}
