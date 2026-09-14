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
import {
  correctPhoneSchema,
  type CorrectPhoneInput,
  type CorrectPhoneValues,
} from '@/features/teams/schema'

export interface CorrectPhoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  /** The current number, or null if it was not returned; the field starts from it (AC9). */
  currentPhone: string | null
  pending: boolean
  /** A `phone_taken` from the RPC, shown field-level (AC10); cleared on the next edit. */
  takenError: string | null
  /** Called with the E.164 value; the schema has already normalised and validated it. */
  onSave: (phone: string) => void
}

/**
 * The admin-only phone correction (AC9, AC10, D51). RHF + zodResolver over `correctPhoneSchema`,
 * which normalises through the one `toE164` (D35): an unparseable value is rejected inline with
 * "That doesn't look like a mobile number." and never reaches the network. A `phone_taken` from
 * the RPC lands on the same field as "That number is already registered to someone else." — no
 * Postgres unique-violation string ever surfaces. Not optimistic: Save shows a pending state.
 */
export function CorrectPhoneDialog({
  open,
  onOpenChange,
  memberName,
  currentPhone,
  pending,
  takenError,
  onSave,
}: CorrectPhoneDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CorrectPhoneInput, unknown, CorrectPhoneValues>({
    resolver: zodResolver(correctPhoneSchema),
    defaultValues: { phone: currentPhone ?? '' },
  })

  // Refill from the current number whenever the dialog opens, so a cancelled edit is discarded.
  useEffect(() => {
    if (open) reset({ phone: currentPhone ?? '' })
  }, [open, currentPhone, reset])

  const submit = handleSubmit((values) => {
    onSave(values.phone)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct {memberName}&apos;s number</DialogTitle>
          <DialogDescription>
            This changes the number they sign in with. Get it wrong and they are locked out, so
            check it.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void submit(e)
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.phone || takenError !== null ? true : undefined}>
            <FieldLabel htmlFor="correct-phone">Mobile number</FieldLabel>
            <Input
              id="correct-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="087 123 4567"
              disabled={pending}
              aria-invalid={errors.phone || takenError !== null ? true : undefined}
              {...register('phone')}
            />
            <FieldError
              errors={
                errors.phone
                  ? [errors.phone]
                  : takenError !== null
                    ? [{ message: takenError }]
                    : undefined
              }
            />
          </Field>
          <DialogFooter>
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
              {pending ? 'Working…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
