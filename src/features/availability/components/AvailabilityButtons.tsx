import { useSetResponse } from '@/api/availability'
import { Button } from '@/components/ui/button'
import type { AvailabilityResponse } from '@/features/availability/schema'

export interface AvailabilityButtonsProps {
  eventId: string
  /** The caller's own current answer, or null while awaiting. */
  current: AvailabilityResponse | null
  /** True for a cancelled event here; S3.4 adds the after-`starts_at` case. */
  disabled?: boolean
  /** The line under the buttons when disabled, e.g. "This one's off." (D60). S3.4 supplies the
   *  started-event copy. */
  disabledReason?: string
}

/**
 * The one availability control, shared by S3.1, S3.3 and S3.4 — do not fork it. The optimistic
 * write, rollback and failure line all live in `useSetResponse` and here (D48); tapping the answer
 * already selected fires nothing (D61, AC7). Selected reads as a filled button with
 * `aria-pressed`, the other as an outline (AC6).
 */
export function AvailabilityButtons({
  eventId,
  current,
  disabled = false,
  disabledReason,
}: AvailabilityButtonsProps): React.JSX.Element {
  const setResponse = useSetResponse()

  const choose = (response: AvailabilityResponse): void => {
    if (disabled || response === current) return
    setResponse.mutate({ eventId, response })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          size="lg"
          variant={current === 'available' ? 'default' : 'outline'}
          aria-pressed={current === 'available'}
          disabled={disabled}
          className="min-h-14 w-full"
          onClick={() => {
            choose('available')
          }}
        >
          Yes
        </Button>
        <Button
          type="button"
          size="lg"
          variant={current === 'unavailable' ? 'default' : 'outline'}
          aria-pressed={current === 'unavailable'}
          disabled={disabled}
          className="min-h-14 w-full"
          onClick={() => {
            choose('unavailable')
          }}
        >
          No
        </Button>
      </div>

      {current !== null && (
        <p className="text-sm text-muted-foreground">
          {current === 'available' ? 'You said yes.' : 'You said no.'}
        </p>
      )}

      {disabled && disabledReason !== undefined && (
        <p className="text-sm text-muted-foreground">{disabledReason}</p>
      )}

      {/* Kept in the tree so the failure is announced, not just shown (AC8). Keyed on
          `showRetryLine`, not `isError`: a 42501 window-shut refusal shows no line and settles into
          the closed state instead (S3.4 AC9, AC10). */}
      <p aria-live="polite" className="min-h-5 text-sm text-destructive">
        {setResponse.showRetryLine ? "Couldn't save. Tap again." : ''}
      </p>
    </div>
  )
}
