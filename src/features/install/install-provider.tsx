import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InstallReactContext, type InstallContextValue } from '@/features/install/install-context'
import { resolveInstallContext, type InstallContext } from '@/lib/install-context'
import { isStandalone } from '@/lib/standalone'

/** The Chromium-only event the Android window waits on. Not in the DOM lib types. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** D45: how long the Android branch waits for `beforeinstallprompt` before deciding it is trapped. */
const ANDROID_WINDOW_MS = 3000

/**
 * The synchronous half of the decision, run in render (never in an effect): `standalone` wins, iOS
 * and desktop resolve at once, and Android alone starts in `resolving` and waits on the event or the
 * timer. iOS never fires `beforeinstallprompt`, so there is nothing there to wait for.
 */
function initialContext(): InstallContext {
  if (isStandalone()) return 'standalone'
  const ua = navigator.userAgent
  if (ua.includes('Android')) return 'resolving'
  return resolveInstallContext({ ua, standalone: false, installPromptSeen: false })
}

/**
 * Mounted once, above the router, inside `SessionProvider` and outside `AppBoot` (S2.7), so the
 * `beforeinstallprompt` listener is registered even while the splash is up — the event fires early
 * in the page lifecycle, long before the player responds. The provider owns the listener and the
 * timer; `resolveInstallContext` owns the rules. The context is resolved once per page load and
 * never flips: a late event still populates `promptInstall` for S2.8's menu item, but it does not
 * reclassify a player already looking at the escape prompt (D45).
 */
export function InstallProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [context, setContext] = useState<InstallContext>(initialContext)
  const [hasPrompt, setHasPrompt] = useState(false)
  const deferred = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const ua = navigator.userAgent
    // Only Android waits: standalone, iOS and desktop are already resolved in render, and iOS never
    // fires the event, so there is no listener and no timer to run for them (D44, AC3).
    if (isStandalone() || !ua.includes('Android')) return

    let resolved = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const resolveOnce = (installPromptSeen: boolean): void => {
      if (resolved) return
      resolved = true
      setContext(resolveInstallContext({ ua, standalone: false, installPromptSeen }))
    }

    // Chromium fires this once per page load. Keep the reference for S2.8's Install button; inside
    // the window it also decides `installable`. After the window it only feeds `promptInstall`, so a
    // player already on the escape prompt is never reclassified (D45).
    const onBeforeInstallPrompt = (event: Event): void => {
      event.preventDefault()
      deferred.current = event as BeforeInstallPromptEvent
      setHasPrompt(true)
      if (!resolved) {
        if (timer !== null) clearTimeout(timer)
        resolveOnce(true)
      }
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    timer = setTimeout(() => {
      resolveOnce(false)
    }, ANDROID_WINDOW_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      // Only the Android path reaches here, and the timer is always set by this point.
      clearTimeout(timer)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const event = deferred.current
    if (!event) return 'unavailable'
    await event.prompt()
    const { outcome } = await event.userChoice
    // The event is single-use: null it and drop the button once it has been spent.
    deferred.current = null
    setHasPrompt(false)
    return outcome
  }, [])

  const value = useMemo<InstallContextValue>(
    () => ({ context, promptInstall: hasPrompt ? promptInstall : null }),
    [context, hasPrompt, promptInstall],
  )

  return <InstallReactContext.Provider value={value}>{children}</InstallReactContext.Provider>
}
