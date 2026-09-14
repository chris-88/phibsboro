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
import { eventWriteErrorMessage, useSetEventStatus } from '@/api/events'
import type { EventRow } from '@/features/events/schema'

export interface CancelEventDialogProps {
  event: EventRow
  /** The target status. `cancelled` is cancel; `scheduled` is reinstate. The two differ only in
   *  copy and target, so one component serves both (S4.2). */
  to: 'cancelled' | 'scheduled'
  open: boolean
  onOpenChange: (open: boolean) => void
}

const COPY = {
  cancelled: {
    title: (t: string) => `Cancel ${t}?`,
    body: 'Players will see it marked off. Their answers are kept.',
    confirm: 'Cancel event',
  },
  scheduled: {
    title: (t: string) => `Reinstate ${t}?`,
    body: 'Players can respond again, right up to kick-off.',
    confirm: 'Reinstate',
  },
} as const

/**
 * Cancel and reinstate, one confirmed status write (S4.2). Cancel names the event and states that
 * answers are kept (AC6); dismissing changes nothing. Neither path deletes a row — a cancelled
 * event keeps every response, and the RLS check, not this dialog, refuses new answers (D12, D31).
 * The confirm stays disabled while the write is in flight, so a double tap acts once (AC13).
 */
export function CancelEventDialog({
  event,
  to,
  open,
  onOpenChange,
}: CancelEventDialogProps): React.JSX.Element {
  const setStatus = useSetEventStatus()
  const [error, setError] = useState<string | null>(null)
  const copy = COPY[to]

  const confirm = (): void => {
    setError(null)
    setStatus.mutate(
      { id: event.id, status: to },
      {
        onSuccess: () => {
          toast(to === 'cancelled' ? `${event.title} cancelled.` : `${event.title} reinstated.`)
          onOpenChange(false)
        },
        onError: (e) => {
          setError(eventWriteErrorMessage(e))
        },
      },
    )
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title(event.title)}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>

        {error != null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={setStatus.isPending}>Keep it</AlertDialogCancel>
          <Button
            variant={to === 'cancelled' ? 'destructive' : 'default'}
            onClick={confirm}
            disabled={setStatus.isPending}
          >
            {setStatus.isPending ? 'Saving…' : copy.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
