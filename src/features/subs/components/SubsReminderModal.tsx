import { useState } from 'react'
import { useMySubs } from '@/api/subs'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/features/subs/subs'

/** Dismissal is per session (sessionStorage), so the reminder re-appears on the next app open and
 *  keeps nudging until the balance is cleared, without nagging twice in one sitting. */
const KEY = 'pfc.subsReminderDismissed'
function dismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The auto payment reminder (Epic 19, Y4/S19.3). A signed-in member who still owes sees this on app
 * open — mounted at the root, it renders nothing until subs load and only when there's an outstanding
 * balance, and never twice in a session. "Pay now" opens the admin-set link; "Later" dismisses.
 */
export function SubsReminderModal(): React.JSX.Element | null {
  const subs = useMySubs()
  const [dismissed, setDismissed] = useState(dismissedThisSession)

  if (subs.data === undefined || subs.data.outstanding === 0 || dismissed) return null
  const { outstanding, payLink } = subs.data

  const close = (): void => {
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      // No storage: it just shows again on the next render pass; harmless.
    }
    setDismissed(true)
  }

  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Subs due</AlertDialogTitle>
          <AlertDialogDescription>
            You owe {formatMoney(outstanding)} in subs.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={close}>
            Later
          </Button>
          {payLink !== null && (
            <Button asChild onClick={close}>
              <a href={payLink} target="_blank" rel="noopener noreferrer">
                Pay now
              </a>
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
