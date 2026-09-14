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

export interface RemoveMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The person being removed, named in the confirmation (AC3). */
  memberName: string
  /** Named in the last-manager line when it applies (AC7). */
  teamName: string
  /** True when this removal leaves the team with no manager — adds the extra line (AC7). */
  leavesNoManager: boolean
  pending: boolean
  /** Set after a failed confirm; the dialog stays open with an inline line, the list restored. */
  errorText: string | null
  onConfirm: () => void
}

/**
 * The remove confirmation (AC3, AC7). Names the member and always carries the line that the
 * history is kept (D33) — the manager should not fear losing a season's attendance by tidying the
 * squad. When the target is the team's only manager it adds the last-manager line so the admin is
 * not surprised (AC7). Controlled like `ConfirmLinkDialog`: Confirm is a plain destructive Button,
 * not an `AlertDialogAction`, so a failed remove keeps the dialog open with the inline line.
 */
export function RemoveMemberDialog({
  open,
  onOpenChange,
  memberName,
  teamName,
  leavesNoManager,
  pending,
  errorText,
  onConfirm,
}: RemoveMemberDialogProps): React.JSX.Element {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {memberName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their past availability and attendance are kept.
            {leavesNoManager && <> This leaves {teamName} with no manager.</>}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? 'Working…' : 'Remove'}
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
