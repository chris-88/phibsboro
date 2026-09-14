import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { teamKeys } from '@/api/queryKeys'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Card, CardContent } from '@/components/ui/card'
import { useTeamEvents } from '@/api/events'
import { useEventSquad } from '@/api/squad'
import { squadStatusText } from '@/features/events/squad-picker'
import type { EventRow } from '@/features/events/schema'
import { ManageHeader } from '@/features/teams/components/ManageHeader'
import { MemberList } from '@/features/teams/member-list'
import { NoManagedTeams } from '@/features/teams/components/NoManagedTeams'
import { useActiveTeam } from '@/features/teams/hooks/useActiveTeam'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { locationDisplay } from '@/lib/home-venue'
import { paths } from '@/lib/paths'
import { serverNow } from '@/lib/serverClock'
import { formatEventTime } from '@/lib/time'

/**
 * `/squad` (S10.3, V11/V12): the manager's squad hub. Matchday on top — the managed team's
 * upcoming matches, each opening the squad picker (S9.2; until then the match manager view) — and
 * the S6.4 members list below, reset / remove / change-role one tap away. The team is resolved
 * through `useActiveTeam()`, so a multi-team manager gets the same picker as `/manage` and both
 * sections follow it (AC5, D50). The guard already sent a player home (AC6); RLS bounds every read.
 */
export default function SquadScreen(): React.JSX.Element {
  const { teamId, team, isLoading, isError } = useActiveTeam()
  const account = useCurrentUser()
  const isAdmin = account.status === 'ready' && account.user.isAdmin
  const qc = useQueryClient()

  if (isError) {
    return (
      <div className="py-4">
        <ErrorState
          title="Couldn't load teams."
          onRetry={() => void qc.invalidateQueries({ queryKey: teamKeys.all })}
        />
      </div>
    )
  }
  if (isLoading) {
    return (
      <div className="py-4">
        <LoadingState label="Loading" />
      </div>
    )
  }
  if (teamId === null || team === null) {
    return (
      <div className="py-4">
        <NoManagedTeams />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <header className="min-w-0">
        <ManageHeader />
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Matchday
        </h3>
        <MatchdayList teamId={teamId} />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Members
        </h3>
        {/* The S6.4 roster, embedded not duplicated: reset / remove / change-role, its own four
            states. The admin-only actions follow the caller's role. */}
        <MemberList teamId={teamId} teamName={team.name} isAdmin={isAdmin} />
      </section>
    </div>
  )
}

/**
 * The managed team's upcoming matches (AC2, AC4): type match, kick-off in the future, not
 * cancelled — training and social never appear, and a cancelled match needs no squad. Soonest
 * first. Reuses `useTeamEvents` (no new read); the filter is client-side so the same cached rows
 * back the manage list. Each row links to the squad picker route (S9.2).
 */
function MatchdayList({ teamId }: { teamId: string }): React.JSX.Element {
  const events = useTeamEvents(teamId)

  if (events.isPending) {
    return <LoadingState label="Loading matches" />
  }
  if (events.isError) {
    return <ErrorState title="Couldn't load matches." onRetry={() => void events.refetch()} />
  }

  const nowMs = serverNow().getTime()
  const matches = events.data
    .filter(
      (e) =>
        e.type === 'match' && e.status !== 'cancelled' && new Date(e.starts_at).getTime() >= nowMs,
    )
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())

  if (matches.length === 0) {
    return <EmptyState title="No upcoming matches." />
  }

  return (
    <ul className="flex flex-col gap-2">
      {matches.map((match) => (
        <li key={match.id}>
          <MatchdayRow match={match} />
        </li>
      ))}
    </ul>
  )
}

/** One match row: the fixture, a Kick-off (and Meet, when set) line, and the squad-status hint,
 *  opening the squad picker (S9.2). The status reads the per-match `event_squad` cache the picker
 *  writes — "Squad not picked" until someone is in, then "{n} picked" with a captain note. */
function MatchdayRow({ match }: { match: EventRow }): React.JSX.Element {
  const meet = match.meet_at !== null ? ` · Meet ${formatEventTime(match.meet_at, 'time')}` : ''
  const squad = useEventSquad(match.id)
  const status =
    squad.data === undefined
      ? 'Squad not picked'
      : squadStatusText(
          squad.data.length,
          squad.data.some((s) => s.is_captain),
        )
  return (
    <Card>
      <CardContent className="p-0">
        <Link
          to={paths.squadEvent(match.id)}
          className="flex min-h-tap items-center gap-3 rounded-xl px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate text-base font-semibold text-foreground">{match.title}</span>
            <span className="text-sm text-muted-foreground">
              {formatEventTime(match.starts_at, 'short')}
              {meet} · {locationDisplay(match.location).label}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{status}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  )
}
