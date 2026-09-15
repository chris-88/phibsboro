import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useLocation } from 'react-router'
import { CheckCircle2 } from 'lucide-react'
import { useSubmitFeedback } from '@/api/feedback'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { collectContext } from '@/features/feedback/collect-context'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABEL,
  feedbackInputSchema,
  type FeedbackInput,
} from '@/features/feedback/schema'

const MAX = 2000

export interface FeedbackSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The "Send feedback" form (S12.2), a sheet opened from the header menu on any nav route. The form
 * body is its own component, mounted only while the sheet is open, so each open starts clean — no
 * stale thank-you, half-typed note or lingering error — without a reset effect.
 */
export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps): React.JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0">
        {open && (
          <FeedbackBody
            onDone={() => {
              onOpenChange(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * The form itself. A one-tap category, a message, and Send — with the route, app version and device
 * auto-attached (W2). Four states: the idle form, submitting (the button is busy and cannot
 * double-fire), success (a thank-you), and an inline error that keeps what was typed. `user_id` is
 * never a field — the mutation reads it from the session — so a report can only be filed as oneself.
 */
function FeedbackBody({ onDone }: { onDone: () => void }): React.JSX.Element {
  const { pathname } = useLocation()
  const submit = useSubmitFeedback()
  const [sent, setSent] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackInputSchema),
    defaultValues: { category: 'other', message: '' },
  })

  const message = useWatch({ control, name: 'message' })

  const onSubmit = handleSubmit((values) => {
    submit.mutate(
      { input: values, context: collectContext(pathname) },
      {
        onSuccess: () => {
          setSent(true)
        },
      },
    )
  })

  if (sent) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Thanks!</SheetTitle>
          <SheetDescription>Your feedback's been sent to the club admin.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col items-center gap-4 px-4 pb-6">
          <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
          <Button className="w-full" onClick={onDone}>
            Done
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Send feedback</SheetTitle>
        <SheetDescription>
          Spotted a bug or have an idea? Tell us — your screen and app version come with it.
        </SheetDescription>
      </SheetHeader>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 px-4 pb-6">
        <Field>
          <FieldLabel htmlFor="feedback-category">What's this about?</FieldLabel>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                id="feedback-category"
                value={field.value}
                onValueChange={(v) => {
                  // ToggleGroup clears to '' when the active item is tapped again; keep the current
                  // value rather than letting category go empty.
                  if (v) field.onChange(v)
                }}
                className="w-full"
              >
                {FEEDBACK_CATEGORIES.map((c) => (
                  <ToggleGroupItem key={c} value={c} className="flex-1">
                    {FEEDBACK_CATEGORY_LABEL[c]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </Field>

        <Field data-invalid={errors.message ? true : undefined}>
          <FieldLabel htmlFor="feedback-message">Your feedback</FieldLabel>
          <Controller
            control={control}
            name="message"
            render={({ field }) => (
              <Textarea
                {...field}
                id="feedback-message"
                rows={5}
                maxLength={MAX}
                placeholder="What happened, or what would help?"
                aria-invalid={errors.message ? true : undefined}
              />
            )}
          />
          <div className="flex items-center justify-between">
            <FieldError errors={errors.message ? [errors.message] : undefined} />
            <span className="ml-auto text-xs text-muted-foreground" aria-live="polite">
              {message.length}/{MAX}
            </span>
          </div>
        </Field>

        {submit.isError && (
          <p className="text-sm text-destructive" aria-live="polite">
            Couldn't send that. Check your connection and try again.
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submit.isPending}>
          {submit.isPending ? 'Sending…' : 'Send feedback'}
        </Button>
      </form>
    </>
  )
}
