import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { installCopy } from '@/features/install/install-copy'
import { IosShareIcon } from '@/features/install/ios-share-icon'

/** Which shape the sheet takes, decided by the opener from the latest install context. */
export type InstallSheetVariant = 'ios' | 'installable' | 'android'

/** A numbered list of plain sentences. `children` are the `<li>` rows so step one can carry JSX. */
function Steps({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-foreground">{children}</ol>
  )
}

/**
 * The three iOS steps. Step one carries the share glyph inline in the sentence (AC7); the words
 * around it, not the glyph, are what a screen reader announces.
 */
export function IosSteps(): React.JSX.Element {
  return (
    <Steps>
      <li>
        Tap <IosShareIcon /> at the bottom of the screen.
      </li>
      <li>{installCopy.iosStep2}</li>
      <li>{installCopy.iosStep3}</li>
    </Steps>
  )
}

/** The three written Android steps, shown when no install event is held (AC9). */
export function AndroidSteps(): React.JSX.Element {
  return (
    <Steps>
      <li>{installCopy.androidStep1}</li>
      <li>{installCopy.androidStep2}</li>
      <li>{installCopy.androidStep3}</li>
    </Steps>
  )
}

/**
 * The Install button and its one line. Tapping calls the captured `beforeinstallprompt` event once
 * (D45). `accepted` and `dismissed` close the sheet; `unavailable` or a rejection falls back to the
 * written Android steps in place, so the button is never a dead control.
 */
function InstallableBody({
  promptInstall,
  onDone,
}: {
  promptInstall: NonNullable<InstallSheetProps['promptInstall']>
  onDone: () => void
}): React.JSX.Element {
  const [fellBack, setFellBack] = useState(false)

  if (fellBack) return <AndroidSteps />

  const onInstall = async (): Promise<void> => {
    try {
      const outcome = await promptInstall()
      if (outcome === 'unavailable') {
        setFellBack(true)
        return
      }
      onDone()
    } catch {
      setFellBack(true)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground">{installCopy.installLine}</p>
      <Button
        type="button"
        onClick={() => {
          void onInstall()
        }}
      >
        {installCopy.install}
      </Button>
    </div>
  )
}

export interface InstallSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: InstallSheetVariant
  /** Null unless a `beforeinstallprompt` event is held; only the `installable` variant reads it. */
  promptInstall: (() => Promise<'accepted' | 'dismissed' | 'unavailable'>) | null
}

/**
 * The bottom sheet that shows a player how to install, from the header menu item (S2.8). A shadcn
 * `Sheet`, so it is keyboard dismissable, focus-trapped while open, and returns focus to the control
 * that opened it (AC13) — never a hand-rolled overlay. Content is chosen by `variant`, resolved when
 * the sheet is opened rather than frozen at the 3-second Android mark, so a late install event still
 * yields a real Install button here (unlike the automatic card).
 */
export function InstallSheet({
  open,
  onOpenChange,
  variant,
  promptInstall,
}: InstallSheetProps): React.JSX.Element {
  // Radix unmounts the content when the sheet closes, so the `installable` body's local fallback
  // state resets on each open with no effect of ours.
  //
  // Radix Dialog's modal close focuses its trigger, and this sheet has none — it is opened from a
  // menu item or a card button. Capture whatever held focus when the sheet mounted (still the opener
  // during `onOpenAutoFocus`, before Radix moves focus in) and return focus there on close (AC13).
  const opener = useRef<HTMLElement | null>(null)

  const close = (): void => {
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onOpenAutoFocus={() => {
          opener.current = document.activeElement as HTMLElement | null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          opener.current?.focus()
        }}
      >
        <SheetHeader>
          <SheetTitle>{installCopy.sheetTitle}</SheetTitle>
        </SheetHeader>
        <div>
          {variant === 'ios' && <IosSteps />}
          {variant === 'android' && <AndroidSteps />}
          {variant === 'installable' &&
            (promptInstall ? (
              <InstallableBody promptInstall={promptInstall} onDone={close} />
            ) : (
              <AndroidSteps />
            ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
