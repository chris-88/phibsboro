import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useGenerateTrainingSeries } from '@/api/events'
import type { TrainingSeriesInput } from '@/features/events/schema'
import { seriesErrorMessage } from '@/features/events/series-error-copy'
import { weeklySlots } from '@/lib/series'
import { formatEventTime } from '@/lib/time'

export interface SeriesResult {
  /** How many rows the run actually created. */
  created: number
  /** How many weeks were requested. `created < requested` means some already existed (AC7). */
  requested: number
}

export interface TrainingSeriesConfirmDialogProps {
  /** The composed input, or null while closed. Non-null opens the dialog. */
  input: TrainingSeriesInput | null
  onOpenChange: (open: boolean) => void
  /** Called after a successful run, with the counts for the result line (AC9). */
  onDone: (result: SeriesResult) => void
}

/**
 * The confirm step before any write (S4.6, AC8). It states the count and the span using the same
 * `weeklySlots()` arithmetic the function uses, so the dialog and the database agree, then writes
 * only on confirm. Cancelling issues no request. The action button spins and the footer is held
 * while the RPC settles (UI states); a refusal renders inline and leaves the dialog open.
 */
export function TrainingSeriesConfirmDialog({
  input,
  onOpenChange,
  onDone,
}: TrainingSeriesConfirmDialogProps): React.JSX.Element | null {
  const generate = useGenerateTrainingSeries()
  const [error, setError] = useState<string | null>(null)

  if (!input) return null

  const slots = weeklySlots(input.firstStartsAt, input.weeks)
  const first = slots[0]
  const last = slots[slots.length - 1]
  const noun = input.weeks === 1 ? 'training session' : 'training sessions'

  const confirm = (): void => {
    setError(null)
    generate.mutate(input, {
      onSuccess: (ids) => {
        onDone({ created: ids.length, requested: input.weeks })
      },
      onError: (e) => {
        setError(seriesErrorMessage(e))
      },
    })
  }

  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) {
          setError(null)
          onOpenChange(false)
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            This creates {input.weeks} {noun}.
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {first != null && <p>First: {formatEventTime(first, 'share')}</p>}
          {last != null && <p>Last: {formatEventTime(last, 'share')}</p>}
        </div>

        {error != null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={generate.isPending}>Cancel</AlertDialogCancel>
          <Button onClick={confirm} disabled={generate.isPending}>
            {generate.isPending ? 'Creating…' : 'Create sessions'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
