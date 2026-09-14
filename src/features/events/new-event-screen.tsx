import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { teamKeys } from '@/api/queryKeys'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCreateEvent, eventWriteErrorMessage } from '@/api/events'
import { EventForm } from '@/features/events/components/EventForm'
import {
  TrainingSeriesConfirmDialog,
  type SeriesResult,
} from '@/features/events/components/TrainingSeriesConfirmDialog'
import {
  DEFAULT_TITLES,
  type EventFormValues,
  type TrainingSeriesInput,
} from '@/features/events/schema'
import { ManageHeader } from '@/features/teams/components/ManageHeader'
import { NoManagedTeams } from '@/features/teams/components/NoManagedTeams'
import { useActiveTeam } from '@/features/teams/hooks/useActiveTeam'
import type { Team } from '@/features/teams/schema'
import { paths } from '@/lib/paths'
import { dublinLocalToUtcIso } from '@/lib/time'

/**
 * `/manage/event/new` (S4.1). The team is the manage area's active team, resolved through
 * `useActiveTeam()` and shown in the S6.3 header picker — no `?team=` query param, no in-form team
 * dropdown (S6.3 supersedes S4.1's implementation note). Switching team in the header re-scopes
 * the form. An inactive team refuses every create path, so the form is replaced with a line rather
 * than shown disabled (AC5). The guard already sent a player home (AC10).
 */
export default function NewEventScreen(): React.JSX.Element {
  const { teamId, team, isLoading, isError } = useActiveTeam()
  const qc = useQueryClient()

  if (isLoading) {
    return (
      <div className="py-4">
        <LoadingState rows={1} label="Loading" />
      </div>
    )
  }
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
  // Not reachable in the happy path — the New event button is hidden without a resolvable team.
  if (teamId === null || team === null) {
    return (
      <div className="py-4">
        <NoManagedTeams />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 py-4">
      <ManageHeader />
      {team.active ? (
        // Keyed on the team so switching in the header remounts the form with the new default.
        <NewEventPanel key={team.id} team={team} />
      ) : (
        <EmptyState
          title="This team is inactive."
          body="Reactivate this team to add events."
          action={
            <Button asChild variant="outline">
              <Link to={paths.manage()}>Back to Manage</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}

/** The create form and its mutation, scoped to the active team. Rendered only for an active team,
 *  so the mutation always has a team it may write to. */
function NewEventPanel({ team }: { team: Team }): React.JSX.Element {
  const navigate = useNavigate()
  const create = useCreateEvent()
  const [formError, setFormError] = useState<string | null>(null)
  // The composed series input, held while the confirm dialog is open. Null closes it (S4.6, AC8).
  const [seriesInput, setSeriesInput] = useState<TrainingSeriesInput | null>(null)

  const defaultValues: EventFormValues = {
    teamId: team.id,
    type: 'training',
    title: DEFAULT_TITLES.training,
    date: '',
    time: '',
    location: '',
    notes: '',
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

  // The series path (S4.6): compose the first start in Dublin wall time, then confirm before any
  // write. Nothing is sent until the manager confirms the dialog.
  const onSubmitSeries = (values: EventFormValues, weeks: number): void => {
    setFormError(null)
    setSeriesInput({
      teamId: values.teamId,
      firstStartsAt: dublinLocalToUtcIso(values.date, values.time),
      weeks,
      title: values.title.trim(),
      location: values.location.trim(),
    })
  }

  const onSeriesDone = ({ created, requested }: SeriesResult): void => {
    setSeriesInput(null)
    const notice =
      created === requested
        ? `${String(created)} session${created === 1 ? '' : 's'} created.`
        : `${String(created)} created, ${String(requested - created)} already existed.`
    // Back to the team's event list, where the invalidated eventKeys.all shows the new rows and
    // the notice states what happened (AC9).
    void navigate(paths.manage(), { state: { notice } })
  }

  return (
    <div className="flex flex-col gap-4">
      <EventForm
        mode="create"
        defaultValues={defaultValues}
        teamOptions={[{ id: team.id, name: team.name }]}
        onSubmit={onSubmit}
        submitting={create.isPending}
        submitLabel="Add event"
        formError={formError}
        allowSeries
        onSubmitSeries={onSubmitSeries}
      />
      <TrainingSeriesConfirmDialog
        input={seriesInput}
        onOpenChange={(open) => {
          if (!open) setSeriesInput(null)
        }}
        onDone={onSeriesDone}
      />
    </div>
  )
}
