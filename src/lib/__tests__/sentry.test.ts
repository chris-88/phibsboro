import * as Sentry from '@sentry/react'
import type * as SentryModule from '@sentry/react'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { initSentry, sentryOptions, setSentryUser } from '@/lib/sentry'
import { scrubBreadcrumb, scrubEvent } from '@/lib/sentry-scrub'
import { FAKE_DSN, fakeSentryTransport } from '@/test/sentry-transport'

// setUser is wrapped, not replaced, so the real scope still records what was set.
vi.mock('@sentry/react', async (importOriginal) => {
  const actual = await importOriginal<typeof SentryModule>()
  return { ...actual, setUser: vi.fn(actual.setUser) }
})

afterAll(async () => {
  await Sentry.close()
})

describe('sentryOptions (AC9, AC2)', () => {
  it('keeps PII, tracing and replay off — turning one on means changing this test', () => {
    // sendDefaultPii is deprecated in SDK v10; dataCollection is its stricter replacement.
    expect(sentryOptions).not.toHaveProperty('sendDefaultPii', true)
    expect(sentryOptions.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: { request: false, response: false },
      httpBodies: [],
      urlQueryParams: false,
    })
    expect(sentryOptions.tracesSampleRate).toBe(0)
    expect(sentryOptions.replaysSessionSampleRate).toBe(0)
    expect(sentryOptions.replaysOnErrorSampleRate).toBe(0)
  })

  it('installs the scrubber on both hooks', () => {
    expect(sentryOptions.beforeSend).toBe(scrubEvent)
    expect(sentryOptions.beforeBreadcrumb).toBe(scrubBreadcrumb)
  })

  it('tags the release from VITE_SENTRY_RELEASE, the same value S0.5 puts in the meta tag', () => {
    expect(sentryOptions.release).toBe(import.meta.env.VITE_SENTRY_RELEASE)
    expect(sentryOptions.release).toBeTruthy()
  })

  it('leaves the default integrations in place (AC6)', () => {
    expect(sentryOptions.integrations).toBeUndefined()
    expect(sentryOptions).not.toHaveProperty('defaultIntegrations')
  })
})

describe('initSentry with no DSN (AC1)', () => {
  it('is a no-op that throws nothing and exposes nothing', () => {
    expect(import.meta.env.VITE_SENTRY_DSN).toBe('')
    expect(sentryOptions.enabled).toBe(false)
    expect(() => {
      initSentry()
    }).not.toThrow()
    expect(Sentry.isInitialized()).toBe(false)
    expect(Sentry.getClient()).toBeUndefined()
    expect('__pfcSentry' in window).toBe(false)
  })
})

describe('initSentry against a fake transport', () => {
  const fake = fakeSentryTransport()

  it('captures exactly one event for an unhandled promise rejection (AC6)', async () => {
    initSentry({ dsn: FAKE_DSN, enabled: true, transport: fake.transport })
    expect(Sentry.isInitialized()).toBe(true)

    // jsdom has no PromiseRejectionEvent constructor; a plain Event with the same fields is
    // what the global handler reads.
    const rejection = new Event('unhandledrejection')
    Object.assign(rejection, {
      reason: new Error('rejected 0871234567'),
      promise: Promise.resolve(),
    })
    window.dispatchEvent(rejection)
    await Sentry.flush(2000)

    const events = fake.events()
    expect(events).toHaveLength(1)
    const exception = events[0]?.exception as { values: { value: string }[] }
    expect(exception.values[0]?.value).toBe('rejected [phone]')
    expect(events[0]?.release).toBe(import.meta.env.VITE_SENTRY_RELEASE)
    expect(fake.bodies.join('')).not.toContain('0871234567')
  })

  it('exposes one console handle for the once-per-release check (AC3)', async () => {
    const handle = (window as Window & { __pfcSentry?: Record<string, unknown> }).__pfcSentry
    expect(handle).toBeDefined()
    expect(Object.keys(handle ?? {})).toEqual(['captureException'])
    const before = fake.events().length
    const capture = handle?.captureException as (error: unknown) => string
    expect(capture(new Error('sentry smoke'))).toMatch(/^[0-9a-f]{32}$/)
    await Sentry.flush(2000)
    expect(fake.events()).toHaveLength(before + 1)
  })

  it('setSentryUser sets { id } and nothing else, and null clears it (AC10)', () => {
    const setUser = vi.mocked(Sentry.setUser)
    setUser.mockClear()

    setSentryUser('abc')
    expect(setUser).toHaveBeenLastCalledWith({ id: 'abc' })
    expect(Sentry.getIsolationScope().getUser()).toEqual({ id: 'abc' })

    setSentryUser(null)
    expect(setUser).toHaveBeenLastCalledWith(null)
    expect(Sentry.getIsolationScope().getUser()?.id).toBeUndefined()
    expect(setUser).toHaveBeenCalledTimes(2)
  })
})
