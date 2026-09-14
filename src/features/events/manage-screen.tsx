import { Plus } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTeamEvents } from '@/api/events'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { EventListRow } from '@/features/events/components/EventListRow'
import type { EventRow } from '@/features/events/schema'
import { useManageStore } from '@/features/teams/manageStore'
import { paths } from '@/lib/paths'
import { serverNow } from '@/lib/serverClock'

/**
 * `/manage` (S4.1): the manager landing list. A team picker when they manage more than one, a
 * New event button, and the team's events split into Upcoming and Past against `serverNow()` —
 * never the device clock, so an event starting in half an hour stays Upcoming even on a phone set
 * an hour fast (AC13, D48). Cancelled events stay in place, badged (D60). The guard already sent a
 * player home (AC10).
 */
export default function ManageScreen(): React.JSX.Element {
  const account = useCurrentUser()

  if (account.status === 'loading') {
    return (
      <div className="py-4">
        <LoadingState label="Loading" />
      </div>
    )
  }
  if (account.status === 'error') {
    return (
      <div className="py-4">
        <ErrorState title="Couldn't load your account." onRetry={account.refetch} />
      </div>
    )
  }
  if (account.status === 'signedOut') {
    return <Navigate to={paths.login()} replace />
  }

  return <ManageList teams={account.user.managedTeams} />
}

interface TeamRef {
  teamId: string
  teamName: string
}

function ManageList({ teams }: { teams: readonly TeamRef[] }): React.JSX.Element {
  const selectedTeamId = useManageStore((s) => s.selectedTeamId)
  const setSelectedTeamId = useManageStore((s) => s.setSelectedTeamId)

  if (teams.length === 0) {
    return (
      <div className="py-4">
        <EmptyState title="You don't manage a team yet." />
      </div>
    )
  }

  const valid = selectedTeamId != null && teams.some((t) => t.teamId === selectedTeamId)
  const teamId = valid ? selectedTeamId : (teams[0]?.teamId ?? '')
  const team = teams.find((t) => t.teamId === teamId)
  const multiTeam = teams.length > 1

  return (
    <div className="flex flex-col gap-4 py-4">
      <header className="flex items-center justify-between gap-3">
        <h2 className="truncate text-sm font-medium text-muted-foreground">{team?.teamName}</h2>
        <Button asChild size="sm">
          <Link to={`${paths.newEvent()}?team=${teamId}`}>
            <Plus className="size-4" aria-hidden="true" />
            New event
          </Link>
        </Button>
      </header>

      {multiTeam && (
        <Select
          value={teamId}
          onValueChange={(v) => {
            setSelectedTeamId(v)
          }}
        >
          <SelectTrigger className="w-full" aria-label="Team">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.teamId} value={t.teamId}>
                {t.teamName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <TeamEvents teamId={teamId} />
    </div>
  )
}

/** Splits one team's events into Upcoming (ascending) and Past (reverse-chronological) against a
 *  server timestamp. Cancelled events keep their slot, badged by `EventListRow` (D60). */
function TeamEvents({ teamId }: { teamId: string }): React.JSX.Element {
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
        title="No events yet."
        body="Add Saturday's match."
        action={
          <Button asChild>
            <Link to={`${paths.newEvent()}?team=${teamId}`}>New event</Link>
          </Button>
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
      <EventSection title="Upcoming" events={upcoming} emptyHint="Nothing coming up." />
      {past.length > 0 && <EventSection title="Past" events={past} />}
    </div>
  )
}

function EventSection({
  title,
  events,
  emptyHint,
}: {
  title: string
  events: EventRow[]
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
              <EventListRow event={event} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
