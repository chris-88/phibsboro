import { useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch, type Resolver } from 'react-hook-form'
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
import { Switch } from '@/components/ui/switch'
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
  /** S4.6: create mode only. Enables the "Repeat weekly" switch and the horizon control, shown
   *  only while the type is `training` (AC1). The edit dialog never passes it, so the shared form
   *  is unchanged there. */
  allowSeries?: boolean
  /** Called instead of `onSubmit` when the switch is on and the type is `training`. The screen
   *  composes the first start and opens the confirm dialog (AC8). */
  onSubmitSeries?: (values: EventFormValues, weeks: number) => void
}

/** The horizon the manager may pick, in whole weeks. Capped at 16 (D30); the Select offers no
 *  more, so the UI cannot produce a payload the function would refuse (AC3). */
const HORIZON_WEEKS = [4, 8, 12, 16] as const
const DEFAULT_HORIZON = 12

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
  allowSeries = false,
  onSubmitSeries,
}: EventFormProps): React.JSX.Element {
  // S4.6 UI state, create mode only. Neither field belongs to the event schema — a series is a
  // different write — so they are local state, not RHF fields.
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [weeks, setWeeks] = useState<number>(DEFAULT_HORIZON)
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

  // The live type, so the series switch appears only for training and clears when set to match.
  const currentType = useWatch({ control, name: 'type' })
  const seriesOn = allowSeries && repeatWeekly && currentType === 'training'

  const submit = handleSubmit((values) => {
    if (seriesOn && onSubmitSeries) {
      onSubmitSeries(values, weeks)
    } else {
      onSubmit(values)
    }
  })

  const multiTeam = teamOptions.length > 1
  const effectiveLabel = seriesOn ? 'Create sessions' : submitLabel

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
                // A series is training-only, so switching to match clears the switch (AC1).
                if (next === 'match') setRepeatWeekly(false)
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

      {/* S4.6: repeat-weekly switch and horizon, shown only when creating a training event (AC1). */}
      {allowSeries && currentType === 'training' && (
        <div className="flex flex-col gap-4 rounded-lg border border-input p-3">
          <label
            htmlFor="event-repeat"
            className="flex min-h-tap items-center justify-between gap-3"
          >
            <span className="flex flex-col">
              <span className="text-sm font-medium">Repeat weekly</span>
              <span className="text-xs text-muted-foreground">
                Create the same session every week.
              </span>
            </span>
            <Switch
              id="event-repeat"
              checked={repeatWeekly}
              onCheckedChange={setRepeatWeekly}
              disabled={submitting}
            />
          </label>

          {repeatWeekly && (
            <Field>
              <FieldLabel htmlFor="event-weeks">How many weeks?</FieldLabel>
              <Select
                value={String(weeks)}
                onValueChange={(v) => {
                  setWeeks(Number(v))
                }}
                disabled={submitting}
              >
                <SelectTrigger id="event-weeks" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HORIZON_WEEKS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} weeks
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>
      )}

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

      {/* A generated series takes no notes; the manager adds them to one occurrence by editing it
          (S4.6, out of scope). Kept mounted but hidden so its registered value survives a toggle. */}
      <div hidden={seriesOn}>
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
      </div>

      {formError != null && formError !== '' && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Saving…' : effectiveLabel}
      </Button>
    </form>
  )
}
