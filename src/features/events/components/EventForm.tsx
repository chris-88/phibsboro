import { useMemo, useRef } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DEFAULT_TITLES,
  eventFormSchema,
  shouldRewriteTitle,
  type EventFormValues,
} from '@/features/events/schema'
import type { EventType } from '@/features/events/schema'
import { serverNow } from '@/lib/serverClock'
import { utcIsoToDublinParts } from '@/lib/time'

export interface EventTeamOption {
  id: string
  name: string
}

export interface EventFormProps {
  mode: 'create' | 'edit'
  defaultValues: EventFormValues
  /** The manager's active managed teams. A single team hides the picker and scopes the form
   *  implicitly; more than one shows a required select (AC8). */
  teamOptions: readonly EventTeamOption[]
  /** Called when the picker changes, so the screen can mirror the choice into `?team=` and the
   *  store (AC8). */
  onTeamChange?: (teamId: string) => void
  onSubmit: (values: EventFormValues) => void
  /** In flight: the submit is disabled so a double tap creates one row (AC11). */
  submitting: boolean
  submitLabel: string
  /** A form-level failure, rendered above the button with the typed values intact (AC9). */
  formError?: string | null
}

/**
 * The field set shared by create (S4.1) and the edit dialog (S4.2). It owns no mutation: the
 * screen passes `onSubmit`. The schema is a factory so the future-only rule is a flag, and its
 * `now` is `serverNow()` — never the device clock (D48, AC6). shadcn throughout (D40).
 */
export function EventForm({
  mode,
  defaultValues,
  teamOptions,
  onTeamChange,
  onSubmit,
  submitting,
  submitLabel,
  formError,
}: EventFormProps): React.JSX.Element {
  // Captured once at mount: the resolver's `now` and the date input's `min` share one instant.
  const now = useMemo(() => serverNow(), [])
  // The event's start as opened, captured once, so an edit that leaves date and time untouched is
  // held to the length and 365-day rules but not the future-only one — last night's location typo
  // stays fixable (AC5). Create has no original instant, so it is always future-only.
  const original = useRef({ date: defaultValues.date, time: defaultValues.time })
  // A per-validation resolver, not a memoised one: `requireFuture` is recomputed from the current
  // date/time each time the form validates, so a manager who opens a past event and moves it
  // forward is held to a future instant, while `now` stays the one server instant (AC5, D48).
  const resolver = useMemo<Resolver<EventFormValues>>(
    () => (values, context, options) => {
      const moved =
        mode === 'create' ||
        values.date !== original.current.date ||
        values.time !== original.current.time
      return zodResolver(eventFormSchema({ requireFuture: moved, now }))(values, context, options)
    },
    [mode, now],
  )
  const minDate = utcIsoToDublinParts(now.toISOString()).date

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EventFormValues>({ resolver, defaultValues, mode: 'onBlur' })

  const submit = handleSubmit((values) => {
    onSubmit(values)
  })

  const multiTeam = teamOptions.length > 1

  return (
    <form
      onSubmit={(e) => {
        void submit(e)
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {multiTeam && (
        <Field data-invalid={errors.teamId ? true : undefined}>
          <FieldLabel htmlFor="event-team">Team</FieldLabel>
          <Controller
            control={control}
            name="teamId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  onTeamChange?.(value)
                }}
                disabled={submitting}
              >
                <SelectTrigger
                  id="event-team"
                  className="w-full"
                  aria-invalid={errors.teamId ? true : undefined}
                >
                  <SelectValue placeholder="Pick a team" />
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={errors.teamId ? [errors.teamId] : undefined} />
        </Field>
      )}

      <Field data-invalid={errors.type ? true : undefined}>
        <FieldLabel htmlFor="event-type">Type</FieldLabel>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              id="event-type"
              className="w-full"
              value={field.value}
              onValueChange={(value) => {
                // Radix fires '' when the active item is tapped again; ignore it so a type is
                // always selected.
                if (value === '') return
                const next = value as EventType
                field.onChange(next)
                if (shouldRewriteTitle(getValues('title'), next)) {
                  setValue('title', DEFAULT_TITLES[next], { shouldValidate: true })
                }
              }}
              disabled={submitting}
            >
              <ToggleGroupItem value="training" variant="outline" className="flex-1">
                Training
              </ToggleGroupItem>
              <ToggleGroupItem value="match" variant="outline" className="flex-1">
                Match
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        />
        <FieldError errors={errors.type ? [errors.type] : undefined} />
      </Field>

      <Field data-invalid={errors.title ? true : undefined}>
        <FieldLabel htmlFor="event-title">Title</FieldLabel>
        <Input
          id="event-title"
          disabled={submitting}
          aria-invalid={errors.title ? true : undefined}
          {...register('title')}
        />
        <FieldError errors={errors.title ? [errors.title] : undefined} />
      </Field>

      <Field data-invalid={errors.date ? true : undefined}>
        <FieldLabel htmlFor="event-date">Date</FieldLabel>
        <Input
          id="event-date"
          type="date"
          min={minDate}
          disabled={submitting}
          aria-invalid={errors.date ? true : undefined}
          {...register('date')}
        />
        <FieldError errors={errors.date ? [errors.date] : undefined} />
      </Field>

      <Field data-invalid={errors.time ? true : undefined}>
        <FieldLabel htmlFor="event-time">Start time</FieldLabel>
        <Input
          id="event-time"
          type="time"
          disabled={submitting}
          aria-invalid={errors.time ? true : undefined}
          {...register('time')}
        />
        <FieldError errors={errors.time ? [errors.time] : undefined} />
      </Field>

      <Field data-invalid={errors.location ? true : undefined}>
        <FieldLabel htmlFor="event-location">Location</FieldLabel>
        <Input
          id="event-location"
          disabled={submitting}
          aria-invalid={errors.location ? true : undefined}
          {...register('location')}
        />
        <FieldError errors={errors.location ? [errors.location] : undefined} />
      </Field>

      <Field data-invalid={errors.notes ? true : undefined}>
        <FieldLabel htmlFor="event-notes">Notes (optional)</FieldLabel>
        <Textarea
          id="event-notes"
          rows={3}
          disabled={submitting}
          aria-invalid={errors.notes ? true : undefined}
          {...register('notes')}
        />
        <FieldError errors={errors.notes ? [errors.notes] : undefined} />
      </Field>

      {formError != null && formError !== '' && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
