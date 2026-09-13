import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  /** Set after a failed confirm; keeps the dialog open with an inline line (UI states table). */
  errorText: string | null
  onConfirm: () => void
}

/**
 * The confirm step shared by Regenerate and Revoke (S6.2, AC6/AC7). Controlled, because the
 * dialog must stay open with an inline line when the mutation fails and close only on success —
 * so the confirm is a plain Button, not an `AlertDialogAction`, which would close on click. The
 * destructive action sits second with Cancel first; Confirm reads "Working…" and is disabled
 * while the mutation runs, Cancel stays live.
 */
export function ConfirmLinkDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  errorText,
  onConfirm,
}: ConfirmLinkDialogProps): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </AlertDialogFooter>
        {errorText !== null && (
          <p role="alert" className="text-sm text-destructive">
            {errorText}
          </p>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
