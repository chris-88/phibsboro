import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { teamKeys } from '@/api/queryKeys'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useTeamEvents } from '@/api/events'
import { EventListRow } from '@/features/events/components/EventListRow'
import type { EventRow } from '@/features/events/schema'
import { ManageHeader } from '@/features/teams/components/ManageHeader'
import { NoManagedTeams } from '@/features/teams/components/NoManagedTeams'
import { useActiveTeam } from '@/features/teams/hooks/useActiveTeam'
import { paths } from '@/lib/paths'
import { serverNow } from '@/lib/serverClock'

/**
 * `/manage` (S4.1): the manager landing list. The header names the active team and, for an admin
 * or a multi-team manager, becomes S6.3's team picker; the team is resolved through
 * `useActiveTeam()`, the single source of truth (D50, AC4). A New event button, disabled with a
 * line on an inactive team (AC5), and the team's events split into Upcoming and Past against
 * `serverNow()` — never the device clock (AC13, D48). Cancelled events stay in place, badged
 * (D60). The guard already sent a player home (AC10).
 */
export default function ManageScreen(): React.JSX.Element {
  return (
    <>
      <SeriesNotice />
      <ManageBody />
    </>
  )
}

function ManageBody(): React.JSX.Element {
  const { teamId, team, isLoading, isError } = useActiveTeam()
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
    <div className="flex flex-col gap-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ManageHeader />
        </div>
        {team.active ? (
          <Button asChild size="sm">
            <Link to={paths.newEvent()}>
              <Plus className="size-4" aria-hidden="true" />
              New event
            </Link>
          </Button>
        ) : (
          <Button size="sm" disabled aria-disabled>
            <Plus className="size-4" aria-hidden="true" />
            New event
          </Button>
        )}
      </header>

      {/* On an inactive team every create path is refused by RLS (D50); say why once (AC5). */}
      {!team.active && (
        <p className="text-xs text-muted-foreground">Reactivate this team to add events.</p>
      )}

      <TeamEvents teamId={teamId} teamName={team.name} active={team.active} />
    </div>
  )
}

/**
 * The result line after a recurring-training run (S4.6, AC9). The message is handed over in the
 * navigation state; it is read once into local state and the history entry replaced, so a refresh
 * or a back-and-forward does not resurrect it.
 */
function SeriesNotice(): React.JSX.Element | null {
  const location = useLocation()
  const state: unknown = location.state
  const stateNotice =
    typeof state === 'object' &&
    state !== null &&
    'notice' in state &&
    typeof state.notice === 'string'
      ? state.notice
      : null
  const [notice, setNotice] = useState<string | null>(stateNotice)

  useEffect(() => {
    if (stateNotice != null) {
      window.history.replaceState({}, '')
    }
  }, [stateNotice])

  if (notice == null) return null
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <span>{notice}</span>
      <button
        type="button"
        onClick={() => {
          setNotice(null)
        }}
        className="min-h-tap min-w-tap shrink-0 px-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  )
}

/** Splits one team's events into Upcoming (ascending) and Past (reverse-chronological) against a
 *  server timestamp. Cancelled events keep their slot, badged by `EventListRow` (D60). An inactive
 *  team offers no create control (AC5). */
function TeamEvents({
  teamId,
  teamName,
  active,
}: {
  teamId: string
  teamName: string
  active: boolean
}): React.JSX.Element {
  const events = useTeamEvents(teamId)

  if (events.isPending) {
    return <LoadingState label="Loading events" />
  }
  if (events.isError) {
    return <ErrorState title="Couldn't load your events." onRetry={() => void events.refetch()} />
  }

  const rows = events.data
  if (rows.length === 0) {
    return (
      <EmptyState
        title={active ? 'No events yet.' : 'Nothing on for this team.'}
        body={active ? "Add Saturday's match." : undefined}
        action={
          active ? (
            <Button asChild>
              <Link to={paths.newEvent()}>New event</Link>
            </Button>
          ) : undefined
        }
      />
    )
  }

  const nowMs = serverNow().getTime()
  const upcoming: EventRow[] = []
  const past: EventRow[] = []
  for (const event of rows) {
    if (new Date(event.starts_at).getTime() >= nowMs) upcoming.push(event)
    else past.push(event)
  }
  past.reverse()

  return (
    <div className="flex flex-col gap-6">
      <EventSection
        title="Upcoming"
        events={upcoming}
        teamName={teamName}
        emptyHint="Nothing coming up."
      />
      {past.length > 0 && <EventSection title="Past" events={past} teamName={teamName} />}
    </div>
  )
}

function EventSection({
  title,
  events,
  teamName,
  emptyHint,
}: {
  title: string
  events: EventRow[]
  teamName: string
  emptyHint?: string
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {events.length === 0 ? (
        emptyHint !== undefined && <p className="px-1 text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <li key={event.id}>
              <EventListRow event={event} teamName={teamName} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
