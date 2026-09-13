import { registerSW } from 'virtual:pwa-register'

export interface RegisterServiceWorkerDeps {
  /** Injected so the reload-once guard is unit testable; jsdom's location is unforgeable. */
  reload?: () => void
  register?: typeof registerSW
}

/**
 * D43: `autoUpdate`, one silent reload when a new worker takes control, and an update check
 * whenever the tab becomes visible — a player who installed in March opens the app on a
 * Tuesday night, and that is the moment to pick up April's build.
 */
export function registerServiceWorker({
  reload = () => {
    window.location.reload()
  },
  register = registerSW,
}: RegisterServiceWorkerDeps = {}): void {
  if (!('serviceWorker' in navigator)) return
  const container = navigator.serviceWorker

  let reloaded = false
  const reloadOnce = (): void => {
    if (reloaded) return
    reloaded = true
    reload()
  }

  // A first install claims the page without a reload: the page it claims was just fetched
  // from the network and is the freshest build there is. Only a takeover reloads.
  let hadController = container.controller !== null
  container.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    reloadOnce()
  })

  let registration: ServiceWorkerRegistration | undefined
  register({
    immediate: true,
    // workbox-window's own "new worker activated" signal, routed through the same guard
    // so its default reload and the controllerchange reload can never both fire.
    onNeedReload: reloadOnce,
    onRegisteredSW: (_url, r) => {
      registration = r
    },
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void registration?.update()
  })
}
