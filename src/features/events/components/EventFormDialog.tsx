import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { eventWriteErrorMessage, useUpdateEvent } from '@/api/events'
import { EventForm } from '@/features/events/components/EventForm'
import type { EventActionData, EventFormValues } from '@/features/events/schema'
import { utcIsoToDublinParts } from '@/lib/time'

export interface EventFormDialogProps {
  event: EventActionData
  /** The event's team name, shown read-only: `team_id` is fixed at creation (AC2). */
  teamName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The edit dialog (S4.2, D34): a shadcn `Dialog` over the screen the manager is on, not a route.
 * It owns the `useUpdateEvent()` call so `EventForm` stays mutation-free and both callers keep
 * using it. Pre-filled from the event's current values, the start split into Dublin wall-clock
 * parts through `utcIsoToDublinParts` (AC2). The team is a single option, so `EventForm` renders
 * no picker; its name is shown here as static text.
 */
export function EventFormDialog({
  event,
  teamName,
  open,
  onOpenChange,
}: EventFormDialogProps): React.JSX.Element {
  const update = useUpdateEvent()
  const [formError, setFormError] = useState<string | null>(null)

  const parts = utcIsoToDublinParts(event.starts_at)
  const defaultValues: EventFormValues = {
    teamId: event.team_id,
    type: event.type,
    title: event.title,
    location: event.location,
    notes: event.notes ?? '',
    date: parts.date,
    time: parts.time,
    // Prefilled for a match; a legacy match row from before S8.2 has null home/away, so default
    // the toggle to home. Editing then re-derives and re-stores the title (AC5).
    opponent: event.opponent ?? '',
    homeAway: event.home_away ?? 'home',
    // Prefilled from the stored meet time, split to the Dublin wall clock; blank when unset (S8.3).
    meetTime: event.meet_at !== null ? utcIsoToDublinParts(event.meet_at).time : '',
  }

  const onSubmit = (values: EventFormValues): void => {
    setFormError(null)
    update.mutate(
      { id: event.id, values },
      {
        onSuccess: (row) => {
          toast(`${row.title} updated.`)
          onOpenChange(false)
        },
        onError: (error) => {
          setFormError(eventWriteErrorMessage(error))
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setFormError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
          <DialogDescription>Change any detail. Players keep their answers.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Team</Label>
          <p className="text-sm font-medium text-foreground">{teamName}</p>
        </div>

        {/* A single team option, so EventForm renders no picker; the name shows above (AC2). */}
        <EventForm
          mode="edit"
          defaultValues={defaultValues}
          teamOptions={[{ id: event.team_id, name: teamName }]}
          onSubmit={onSubmit}
          submitting={update.isPending}
          submitLabel="Save changes"
          formError={formError}
        />
      </DialogContent>
    </Dialog>
  )
}
