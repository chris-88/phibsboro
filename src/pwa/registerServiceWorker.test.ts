import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RegisterSWOptions } from 'virtual:pwa-register'
import { registerServiceWorker } from '@/pwa/registerServiceWorker'

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn(() => () => Promise.resolve()) }))

/** A stand-in for navigator.serviceWorker, which jsdom does not provide. */
function installContainer(controller: ServiceWorker | null) {
  const container = new EventTarget() as EventTarget & { controller: ServiceWorker | null }
  container.controller = controller
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true })
  return container
}

function setup(controller: ServiceWorker | null) {
  const container = installContainer(controller)
  const reload = vi.fn()
  const registration = { update: vi.fn(() => Promise.resolve()) }
  let options: RegisterSWOptions | undefined
  const register = vi.fn((o?: RegisterSWOptions) => {
    options = o
    o?.onRegisteredSW?.('/sw.js', registration as unknown as ServiceWorkerRegistration)
    return () => Promise.resolve()
  })
  registerServiceWorker({ reload, register })
  const fire = () => container.dispatchEvent(new Event('controllerchange'))
  return { reload, register, registration, fire, options: () => options }
}

const controlled = {} as ServiceWorker

describe('registerServiceWorker (AC11)', () => {
  let visibility: DocumentVisibilityState = 'visible'
  beforeEach(() => {
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error -- remove the stand-in so the next test starts from jsdom's bare navigator
    delete navigator.serviceWorker
  })

  it('registers immediately, in autoUpdate mode with its reload routed through the guard', () => {
    const { register, options } = setup(controlled)
    expect(register).toHaveBeenCalledOnce()
    expect(options()?.immediate).toBe(true)
    expect(typeof options()?.onNeedReload).toBe('function')
  })

  it('reloads once when a new worker takes over, however many signals arrive', () => {
    const { reload, fire, options } = setup(controlled)
    fire()
    fire()
    options()?.onNeedReload?.()
    fire()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('does not reload when the first worker claims a page that was never controlled', () => {
    const { reload, fire } = setup(null)
    fire()
    expect(reload).not.toHaveBeenCalled()
    // A later takeover in the same tab is still an update.
    fire()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('checks for an update when the tab becomes visible, and not when it hides', () => {
    const { registration } = setup(controlled)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).not.toHaveBeenCalled()
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(registration.update).toHaveBeenCalledOnce()
  })

  it('is a no-op where service workers are unsupported', () => {
    const register = vi.fn()
    registerServiceWorker({ reload: vi.fn(), register })
    expect(register).not.toHaveBeenCalled()
  })
})
