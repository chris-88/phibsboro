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
import { correctNameSchema, type CorrectNameValues } from '@/features/teams/schema'

export interface CorrectNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The current name; the field starts from it so a cancelled edit is discarded. */
  currentName: string
  pending: boolean
  /** A non-field error from the RPC (e.g. a refused write), shown above the footer. */
  errorText: string | null
  /** Called with the trimmed name; the schema has already validated it. */
  onSave: (name: string) => void
}

/**
 * Corrects a player's name so the team sheet, roster and shares read right (S20.2, feedback #7).
 * RHF + zodResolver over `correctNameSchema` (trimmed, 1-60 chars) — an empty or over-long name is
 * rejected inline and never reaches the network. Not optimistic: Save shows a pending state. Unlike
 * the phone correction this changes nothing they sign in with, so the copy is calmer.
 */
export function CorrectNameDialog({
  open,
  onOpenChange,
  currentName,
  pending,
  errorText,
  onSave,
}: CorrectNameDialogProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CorrectNameValues>({
    resolver: zodResolver(correctNameSchema),
    defaultValues: { name: currentName },
  })

  // Refill from the current name whenever the dialog opens, so a cancelled edit is discarded.
  useEffect(() => {
    if (open) reset({ name: currentName })
  }, [open, currentName, reset])

  const submit = handleSubmit((values) => {
    onSave(values.name)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct the name</DialogTitle>
          <DialogDescription>
            Fix a typo from sign-up so the team sheet and roster read right.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            void submit(e)
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <Field data-invalid={errors.name ? true : undefined}>
            <FieldLabel htmlFor="correct-name">Name</FieldLabel>
            <Input
              id="correct-name"
              type="text"
              autoComplete="off"
              autoCapitalize="words"
              disabled={pending}
              aria-invalid={errors.name ? true : undefined}
              {...register('name')}
            />
            <FieldError errors={errors.name ? [errors.name] : undefined} />
          </Field>
          {errorText !== null && (
            <p role="alert" className="text-sm text-destructive">
              {errorText}
            </p>
          )}
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
