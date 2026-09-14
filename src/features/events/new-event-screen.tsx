import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCreateEvent, eventWriteErrorMessage } from '@/api/events'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { EventForm, type EventTeamOption } from '@/features/events/components/EventForm'
import { DEFAULT_TITLES, type EventFormValues } from '@/features/events/schema'
import { useManageStore } from '@/features/teams/manageStore'
import { paths } from '@/lib/paths'

/**
 * `/manage/event/new` (S4.1). Resolves the manager's active managed teams and handles the account
 * states; the create mutation lives in the child so a team-less manager (its empty state) never
 * touches the query cache. The guard already sent a player home (AC10).
 */
export default function NewEventScreen(): React.JSX.Element {
  const account = useCurrentUser()

  if (account.status === 'loading') {
    return (
      <div className="py-4">
        <LoadingState rows={1} label="Loading" />
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
  // The guard keeps signedOut unreachable; the account query is enabled only when signed in.
  if (account.status !== 'ready') {
    return (
      <div className="py-4">
        <LoadingState rows={1} label="Loading" />
      </div>
    )
  }

  const teamOptions: EventTeamOption[] = account.user.managedTeams.map((t) => ({
    id: t.teamId,
    name: t.teamName,
  }))

  // Not reachable empty in the happy path: a manager with no managed active team (AC8, UI states).
  if (teamOptions.length === 0) {
    return (
      <div className="py-4">
        <EmptyState
          title="You don't manage a team yet."
          action={
            <Button asChild variant="outline">
              <Link to={paths.manage()}>Back to Manage</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return <NewEventPanel teamOptions={teamOptions} />
}

/** The create form and its mutation. Rendered only once at least one managed team exists, so the
 *  team picker (AC8) always has a real choice and the mutation always has a team to write to. */
function NewEventPanel({ teamOptions }: { teamOptions: EventTeamOption[] }): React.JSX.Element {
  const navigate = useNavigate()
  const create = useCreateEvent()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedTeamId = useManageStore((s) => s.selectedTeamId)
  const setSelectedTeamId = useManageStore((s) => s.setSelectedTeamId)
  const [formError, setFormError] = useState<string | null>(null)

  const paramTeam = searchParams.get('team')
  const valid = (id: string | null): id is string =>
    id != null && teamOptions.some((t) => t.id === id)
  // ?team= first, then the store, then the single managed team (AC8). Only ?team= survives a hard
  // refresh; the store persists in S6.3.
  const resolvedTeamId = valid(paramTeam)
    ? paramTeam
    : valid(selectedTeamId)
      ? selectedTeamId
      : (teamOptions[0]?.id ?? '')

  const defaultValues: EventFormValues = {
    teamId: resolvedTeamId,
    type: 'training',
    title: DEFAULT_TITLES.training,
    date: '',
    time: '',
    location: '',
    notes: '',
  }

  const onTeamChange = (teamId: string): void => {
    setSelectedTeamId(teamId)
    const next = new URLSearchParams(searchParams)
    next.set('team', teamId)
    setSearchParams(next, { replace: true })
  }

  const onSubmit = (values: EventFormValues): void => {
    setFormError(null)
    create.mutate(values, {
      onSuccess: (row) => {
        // Lands on the new event's manager view (S4.3 AC14), not back on the list.
        toast(`${row.title} added.`)
        void navigate(paths.manageEvent(row.id), { replace: true })
      },
      onError: (error) => {
        setFormError(eventWriteErrorMessage(error))
      },
    })
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <EventForm
        mode="create"
        defaultValues={defaultValues}
        teamOptions={teamOptions}
        onTeamChange={onTeamChange}
        onSubmit={onSubmit}
        submitting={create.isPending}
        submitLabel="Add event"
        formError={formError}
      />
    </div>
  )
}
