import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useInstallContext } from '@/features/install/install-context'
import { installCopy } from '@/features/install/install-copy'
import { AndroidSteps, InstallSheet } from '@/features/install/install-sheet'
import { dismiss, isDismissed, markShown, wasShown } from '@/lib/prompt-dismissal'

/**
 * The install card, shown once in S2.7's post-response slot for `installable` and `ios-safari`
 * (S2.8). The gate in `PostResponsePrompts` decides escape-vs-install exclusivity (D46); this card
 * adds the second rule — shown once, dismissed forever — so a later response never re-opens it (AC3,
 * AC4). Both keys are read here and written through `prompt-dismissal.ts`, never a literal.
 *
 * An inline `Card` in the flow, below the still-interactive YES / NO, never an overlay: nothing here
 * can prevent, delay or undo a response (AC14). On `installable` the primary is a real Install button
 * calling the captured event (AC5); on `ios-safari` it opens the three-step sheet (AC7).
 */
export function InstallGuideCard({
  onDismiss,
}: {
  onDismiss: () => void
}): React.JSX.Element | null {
  const { context, promptInstall } = useInstallContext()
  const [mode, setMode] = useState<'card' | 'android' | 'hidden'>('card')
  const [sheetOpen, setSheetOpen] = useState(false)

  const eligible = context === 'installable' || context === 'ios-safari'
  // Captured once at mount, never re-read: the effect below writes `shown` on this mount, so this
  // session keeps the card up through its own state changes while a later mount sees it as shown.
  const [blockedAtMount] = useState(() => isDismissed('install') || wasShown('install'))

  useEffect(() => {
    if (eligible && !blockedAtMount) markShown('install')
  }, [eligible, blockedAtMount])

  if (!eligible || blockedAtMount || mode === 'hidden') return null

  // accepted and dismissed both stop the card returning automatically; unavailable or a rejection
  // swaps the button for the written steps in place, so the control is never dead (AC6, error state).
  const handleInstall = async (): Promise<void> => {
    if (!promptInstall) {
      setMode('android')
      return
    }
    try {
      const outcome = await promptInstall()
      if (outcome === 'unavailable') {
        setMode('android')
        return
      }
      dismiss('install')
      setMode('hidden')
      onDismiss()
    } catch {
      setMode('android')
    }
  }

  const handleNotNow = (): void => {
    dismiss('install')
    onDismiss()
  }

  return (
    <>
      <Card role="status" className="mt-4">
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{installCopy.cardLine}</p>

          {mode === 'android' && <AndroidSteps />}

          <div className="flex items-center justify-between gap-2">
            {mode === 'card' &&
              (context === 'installable' ? (
                <Button
                  type="button"
                  onClick={() => {
                    void handleInstall()
                  }}
                >
                  {installCopy.install}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    setSheetOpen(true)
                  }}
                >
                  {installCopy.showMe}
                </Button>
              ))}
            <Button type="button" variant="ghost" className="ml-auto" onClick={handleNotNow}>
              {installCopy.notNow}
            </Button>
          </div>
        </CardContent>
      </Card>

      {context === 'ios-safari' && (
        <InstallSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          variant="ios"
          promptInstall={null}
        />
      )}
    </>
  )
}
