import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  injuryFormSchema,
  type InjuryFormValues,
  type PlayerInjuryRow,
} from '@/features/injury/schema'

export interface InjuryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The current injury, or null when the player is fit — drives the title and the defaults. */
  current: PlayerInjuryRow | null
  savePending: boolean
  clearPending: boolean
  /** A non-field error from either RPC (e.g. a refused write), shown above the footer. */
  errorText: string | null
  onSave: (expectedReturn: string | null, note: string | null) => void
  onClear: () => void
}

/**
 * Set, update or clear an injury (S20.3). Informational only (Z2): an optional expected-return date
 * and an optional note, both trimmed and `''` → `null` before submit. When the player is already
 * injured the footer also offers "Mark as fit", which clears the record. RHF + zodResolver over
 * `injuryFormSchema`; the copy says plainly it does not change availability.
 */
export function InjuryDialog({
  open,
  onOpenChange,
  current,
  savePending,
  clearPending,
  errorText,
  onSave,
  onClear,
}: InjuryDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InjuryFormValues>({
    resolver: zodResolver(injuryFormSchema),
    defaultValues: { expectedReturn: current?.expected_return ?? '', note: current?.note ?? '' },
  })

  useEffect(() => {
    if (open) {
      reset({ expectedReturn: current?.expected_return ?? '', note: current?.note ?? '' })
    }
  }, [open, current, reset])

  const submit = handleSubmit((values) => {
    const expectedReturn = values.expectedReturn.trim()
    const note = values.note.trim()
    onSave(expectedReturn === '' ? null : expectedReturn, note === '' ? null : note)
  })

  const pending = savePending || clearPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current !== null ? 'Update injury' : 'Mark injured'}</DialogTitle>
          <DialogDescription>
            A heads-up only — it does not change availability or selection.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void submit(e)
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <Field>
            <FieldLabel htmlFor="injury-return">Expected return (optional)</FieldLabel>
            <Input
              id="injury-return"
              type="date"
              disabled={pending}
              {...register('expectedReturn')}
            />
          </Field>
          <Field data-invalid={errors.note ? true : undefined}>
            <FieldLabel htmlFor="injury-note">Note (optional)</FieldLabel>
            <Textarea
              id="injury-note"
              rows={3}
              placeholder="e.g. hamstring, back in a couple of weeks"
              disabled={pending}
              aria-invalid={errors.note ? true : undefined}
              {...register('note')}
            />
            <FieldError errors={errors.note ? [errors.note] : undefined} />
          </Field>
          {errorText !== null && (
            <p role="alert" className="text-sm text-destructive">
              {errorText}
            </p>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {current !== null ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  onClear()
                }}
              >
                {clearPending ? 'Working…' : 'Mark as fit'}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {savePending ? 'Working…' : 'Save'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
