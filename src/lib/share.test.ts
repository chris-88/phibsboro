import * as Sentry from '@sentry/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canShareNatively, shareText } from '@/lib/share'
import { waMeUrl } from '@/lib/shareMessage'

vi.mock('@sentry/react', () => ({ addBreadcrumb: vi.fn() }))
const addBreadcrumb = vi.mocked(Sentry.addBreadcrumb)

// A stand-in message. The real hash-route encoding is proved in shareMessage.test.ts; this module
// only needs to move a multi-line string through the transports, so no hash-route literal here.
const MESSAGE =
  '🏃 Training\nSat 18 Jul, 6:30pm\nDalymount Park\n\nAre you available? https://app.example/e/1'

function setShare(value: unknown): void {
  Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true })
}

function setSecureContext(value: boolean): void {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true, writable: true })
}

let assign: ReturnType<typeof vi.fn<(url: string) => void>>
const realLocation = window.location

function stubLocation(assignImpl: (url: string) => void): void {
  // jsdom's location.assign is non-configurable, so replace the whole location object. shareText
  // only ever calls location.assign, so a minimal stand-in is enough.
  Object.defineProperty(window, 'location', {
    value: { assign: assignImpl },
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  setSecureContext(true)
  addBreadcrumb.mockClear()
  assign = vi.fn<(url: string) => void>()
  stubLocation((url) => {
    assign(url)
  })
})

afterEach(() => {
  setShare(undefined)
  Object.defineProperty(window, 'location', {
    value: realLocation,
    configurable: true,
    writable: true,
  })
  vi.restoreAllMocks()
})

describe('canShareNatively', () => {
  it('is true only when navigator.share is a function in a secure context', () => {
    setShare(vi.fn())
    expect(canShareNatively()).toBe(true)
    setSecureContext(false)
    expect(canShareNatively()).toBe(false)
    setSecureContext(true)
    setShare(undefined)
    expect(canShareNatively()).toBe(false)
  })
})

describe('shareText', () => {
  it('shares natively with exactly { text }, no url or title (AC2)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)
    const outcome = await shareText(MESSAGE)
    expect(outcome).toStrictEqual({ status: 'shared', method: 'native' })
    expect(share).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledWith({ text: MESSAGE })
    // A stricter guard: an added url or title field fails here.
    expect(share.mock.calls[0]?.[0]).toStrictEqual({ text: MESSAGE })
    expect(assign).not.toHaveBeenCalled()
  })

  it('is silent on an AbortError and does not navigate (AC5)', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('', 'AbortError')))
    const outcome = await shareText(MESSAGE)
    expect(outcome).toStrictEqual({ status: 'cancelled' })
    expect(assign).not.toHaveBeenCalled()
  })

  it('falls through to wa.me on any other rejection (AC6)', async () => {
    setShare(vi.fn().mockRejectedValue(new Error('boom')))
    const outcome = await shareText(MESSAGE)
    expect(outcome).toStrictEqual({ status: 'shared', method: 'wa.me' })
    expect(assign).toHaveBeenCalledWith(waMeUrl(MESSAGE))
  })

  it('goes straight to wa.me when navigator.share is undefined (AC3)', async () => {
    setShare(undefined)
    const outcome = await shareText(MESSAGE)
    expect(outcome).toStrictEqual({ status: 'shared', method: 'wa.me' })
    expect(assign).toHaveBeenCalledWith(waMeUrl(MESSAGE))
  })

  it('reports failed when the wa.me navigation itself throws (AC6)', async () => {
    setShare(undefined)
    stubLocation(() => {
      throw new Error('navigation blocked')
    })
    const outcome = await shareText(MESSAGE)
    expect(outcome).toStrictEqual({ status: 'failed' })
  })
})

describe('share breadcrumbs (AC12, D16)', () => {
  it('records only the transport on a native share, never the body', async () => {
    setShare(vi.fn().mockResolvedValue(undefined))
    await shareText(MESSAGE)
    expect(addBreadcrumb).toHaveBeenCalledTimes(1)
    const crumb = addBreadcrumb.mock.calls[0]?.[0]
    expect(crumb).toMatchObject({
      category: 'share',
      message: 'share.invoked',
      data: { method: 'native' },
    })
    // The message body never appears anywhere in the breadcrumb.
    expect(JSON.stringify(crumb)).not.toContain('Dalymount')
  })

  it('records the wa.me transport when it falls back', async () => {
    setShare(undefined)
    await shareText(MESSAGE)
    expect(addBreadcrumb).toHaveBeenCalledTimes(1)
    expect(addBreadcrumb.mock.calls[0]?.[0]).toMatchObject({ data: { method: 'wa.me' } })
  })

  it('drops no breadcrumb when the user cancels', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('', 'AbortError')))
    await shareText(MESSAGE)
    expect(addBreadcrumb).not.toHaveBeenCalled()
  })
})
