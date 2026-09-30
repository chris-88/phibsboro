import { useState } from 'react'
import { useClearInjury, useMyInjury, useSetInjury } from '@/api/injuries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSignedInUser } from '@/features/auth/use-current-user'
import { InjuryDialog } from '@/features/injury/InjuryDialog'
import { formatReturnDate } from '@/features/injury/injury'

/**
 * The signed-in player's own injury on their profile (S20.3). When fit, a single button to flag
 * themselves injured; when injured, the current status with the expected return and note, and an
 * Update (which also offers Mark as fit). Renders nothing while the read is loading or errored — the
 * profile never blocks on it. Informational only (Z2): it changes nothing about availability.
 */
export function InjuryCard(): React.JSX.Element | null {
  const { id } = useSignedInUser()
  const injury = useMyInjury()
  const setInjury = useSetInjury()
  const clearInjury = useClearInjury()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (injury.data === undefined) return null
  const current = injury.data

  function save(expectedReturn: string | null, note: string | null): void {
    setError(null)
    setInjury.mutate(
      { userId: id, expectedReturn, note },
      {
        onSuccess: () => {
          setOpen(false)
        },
        onError: () => {
          setError("Couldn't save that. Try again.")
        },
      },
    )
  }

  function clear(): void {
    setError(null)
    clearInjury.mutate(
      { userId: id },
      {
        onSuccess: () => {
          setOpen(false)
        },
        onError: () => {
          setError("Couldn't save that. Try again.")
        },
      },
    )
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">Injury</h2>
      {current !== null ? (
        <Card>
          <CardContent className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <Badge variant="destructive" className="w-fit">
                Injured
              </Badge>
              {current.expected_return !== null && (
                <p className="text-sm text-foreground">
                  Expected back {formatReturnDate(current.expected_return)}
                </p>
              )}
              {current.note !== null && (
                <p className="text-sm break-words text-muted-foreground">{current.note}</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setOpen(true)
              }}
            >
              Update
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setOpen(true)
          }}
        >
          Mark yourself injured
        </Button>
      )}

      <InjuryDialog
        open={open}
        onOpenChange={setOpen}
        current={current}
        savePending={setInjury.isPending}
        clearPending={clearInjury.isPending}
        errorText={error}
        onSave={save}
        onClear={clear}
      />
    </section>
  )
}
