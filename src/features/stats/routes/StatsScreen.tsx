import { useMemo, useState } from 'react'
import { useAttendanceStats, usePerformanceStats } from '@/api/stats'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSignedInUser } from '@/features/auth/use-current-user'
import type { AttendanceStatRow, PerformanceStatRow } from '@/features/stats/schema'

/** Whole-number percent, or null when there is nothing to divide by. */
function pct(n: number, d: number): number | null {
  return d === 0 ? null : Math.round((n / d) * 100)
}
const pctText = (p: number | null): string => (p === null ? '—' : `${String(p)}%`)

/**
 * The Stats tab `/stats` (S17.7, X6). One tab, two views — **Attendance** and **Performance** — over
 * a team the viewer belongs to (a picker when they have more than one). The reads are role-aware in
 * the DB: a player sees a single row (their own), a manager/admin the whole squad, so the screen just
 * renders the rows it gets. Guarded `authed`.
 */
export default function StatsScreen(): React.JSX.Element {
  const { isAdmin, memberships, administrableTeams } = useSignedInUser()
  const teams = useMemo(
    () =>
      isAdmin
        ? administrableTeams.map((t) => ({ id: t.id, name: t.name }))
        : memberships.map((m) => ({ id: m.teamId, name: m.teamName })),
    [isAdmin, administrableTeams, memberships],
  )
  const [userTeam, setUserTeam] = useState<string | null>(null)
  const [view, setView] = useState<'attendance' | 'performance'>('attendance')
  const teamId = userTeam ?? teams[0]?.id ?? null

  if (teams.length === 0) {
    return (
      <div className="py-4">
        <EmptyState title="No teams yet." body="Ask your manager for a join link." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="px-1 text-lg font-semibold text-foreground">Stats</h1>

      {teams.length > 1 && (
        <Select value={teamId ?? ''} onValueChange={setUserTeam}>
          <SelectTrigger aria-label="Team">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => {
          if (v === 'attendance' || v === 'performance') setView(v)
        }}
        className="w-full"
      >
        <ToggleGroupItem value="attendance" variant="outline" className="flex-1">
          Attendance
        </ToggleGroupItem>
        <ToggleGroupItem value="performance" variant="outline" className="flex-1">
          Performance
        </ToggleGroupItem>
      </ToggleGroup>

      {view === 'attendance' ? (
        <AttendanceView teamId={teamId} />
      ) : (
        <PerformanceView teamId={teamId} />
      )}
    </div>
  )
}

function AttendanceView({ teamId }: { teamId: string | null }): React.JSX.Element {
  const stats = useAttendanceStats(teamId ?? undefined)

  if (stats.isPending) return <LoadingState rows={4} label="Loading attendance" />
  if (stats.isError)
    return <ErrorState title="Couldn't load attendance." onRetry={() => void stats.refetch()} />
  if (stats.data.length === 0) return <EmptyState title="No attendance yet." />

  // Most reliable first; a single-row (player) view is unaffected.
  const rows = [...stats.data].sort(
    (a, b) =>
      (pct(b.games_attended + b.training_attended, b.games_total + b.training_total) ?? -1) -
      (pct(a.games_attended + a.training_attended, a.games_total + a.training_total) ?? -1),
  )

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <AttendanceRow key={r.user_id} row={r} />
      ))}
    </ul>
  )
}

function AttendanceRow({ row }: { row: AttendanceStatRow }): React.JSX.Element {
  const attended = pct(
    row.games_attended + row.training_attended,
    row.games_total + row.training_total,
  )
  return (
    <li>
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {row.name}
          </span>
          <div className="shrink-0 text-right">
            <p className="text-base font-semibold text-foreground">{pctText(attended)}</p>
            <p className="text-xs text-muted-foreground">
              {row.games_attended}/{row.games_total} games · {row.training_attended}/
              {row.training_total} training · {pctText(pct(row.responded, row.invited))} replied
            </p>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}

function PerformanceView({ teamId }: { teamId: string | null }): React.JSX.Element {
  const stats = usePerformanceStats(teamId ?? undefined)

  if (stats.isPending) return <LoadingState rows={4} label="Loading performance" />
  if (stats.isError)
    return <ErrorState title="Couldn't load performance." onRetry={() => void stats.refetch()} />
  if (stats.data.length === 0) return <EmptyState title="No match stats yet." />

  // Top scorer first (the leaderboard); a player's single row is unaffected.
  const rows = [...stats.data].sort((a, b) => b.goals - a.goals || b.assists - a.assists)

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <PerformanceRow key={r.user_id} row={r} />
      ))}
    </ul>
  )
}

function PerformanceRow({ row }: { row: PerformanceStatRow }): React.JSX.Element {
  return (
    <li>
      <Card>
        <CardContent className="flex items-center gap-3 py-3">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {row.name}
          </span>
          <div className="shrink-0 text-right">
            <p className="text-base font-semibold text-foreground">
              {row.goals} G · {row.assists} A
            </p>
            <p className="text-xs text-muted-foreground">
              {row.appearances} apps · {row.minutes} min
              {row.motm > 0 ? ` · ${String(row.motm)} MOTM` : ''}
              {row.yellow_cards > 0 ? ` · ${String(row.yellow_cards)}Y` : ''}
              {row.red_cards > 0 ? ` · ${String(row.red_cards)}R` : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}
