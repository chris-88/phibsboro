import { useState } from 'react'
import { useInstallContext } from '@/features/install/install-context'
import type { InstallSheetVariant } from '@/features/install/install-sheet'
import { isStandalone } from '@/lib/standalone'

export interface InstallMenuItem {
  /** Hidden when installed or on desktop, and while the Android context is still resolving (AC2). */
  visible: boolean
  /** Which shape the sheet takes, from the latest context — not the frozen 3-second value. */
  variant: InstallSheetVariant
  promptInstall: (() => Promise<'accepted' | 'dismissed' | 'unavailable'>) | null
  isOpen: boolean
  open: () => void
  onOpenChange: (open: boolean) => void
}

/**
 * The header menu item's visibility and the sheet it opens (S2.8). Unlike the automatic card, this
 * uses the latest install state, so a late `beforeinstallprompt` still yields a real Install button
 * here — the player asked, so flipping is safe (D45). It ignores the shown and dismissed keys for the
 * same reason.
 *
 * `visible` follows AC2: never when installed (`isStandalone()`), never on desktop (`other`), and not
 * while Android is still inside its 3-second window, so the item never flickers in and out.
 */
export function useInstallMenuItem(): InstallMenuItem {
  const { context, promptInstall } = useInstallContext()
  const [isOpen, setIsOpen] = useState(false)

  const visible =
    !isStandalone() && context !== 'other' && context !== 'standalone' && context !== 'resolving'

  const variant: InstallSheetVariant =
    context === 'ios-safari' || context === 'ios-inapp'
      ? 'ios'
      : promptInstall !== null
        ? 'installable'
        : 'android'

  return {
    visible,
    variant,
    promptInstall,
    isOpen,
    open: () => {
      setIsOpen(true)
    },
    onOpenChange: setIsOpen,
  }
}
