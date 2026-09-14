import { useState } from 'react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useDeleteEvent } from '@/api/events'
import type { EventActionData } from '@/features/events/schema'

export interface DeleteEventDialogProps {
  event: EventActionData
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful delete, so the event view can navigate back to `/manage`. The list
   *  passes nothing and stays put; the invalidation drops the row on its own (S4.3 handover). */
  onDeleted?: () => void
}

/**
 * The admin hard delete (S4.2, D31). The only path in the app that throws history away: it
 * cascades to every response and attendance row for the event, stated on screen (AC10). The
 * confirm stays disabled until the admin types the title exactly — surrounding whitespace and
 * all — which is the app's only undo. Rendered only when `useCurrentUser().isAdmin`, so a
 * non-admin never sees it; RLS is the real boundary (AC9).
 */
export function DeleteEventDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: DeleteEventDialogProps): React.JSX.Element {
  const del = useDeleteEvent()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const matches = typed === event.title

  const confirm = (): void => {
    if (!matches) return
    setError(null)
    del.mutate(
      { id: event.id },
      {
        onSuccess: () => {
          toast(`${event.title} deleted.`)
          onOpenChange(false)
          onDeleted?.()
        },
        // Both failure modes — RLS refusal and already-gone — leave the admin the same next step,
        // so neither is worth distinguishing on screen (AC9).
        onError: () => {
          setError("You can't delete events.")
        },
      },
    )
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTyped('')
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {event.title}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the event and every response and attendance record for it. It cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-confirm">Type the title to confirm</Label>
          <Input
            id="delete-confirm"
            value={typed}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={del.isPending}
            onChange={(e) => {
              setTyped(e.target.value)
            }}
          />
        </div>

        {error != null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Keep it</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={!matches || del.isPending}>
            {del.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
