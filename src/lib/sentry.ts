import * as Sentry from '@sentry/react'
import { scrubBreadcrumb, scrubEvent } from '@/lib/sentry-scrub'

/**
 * The one options object, exported so a test can pin what must stay off (AC9). Tracing and
 * replay are zeroed rather than omitted so the values are visible: replay would record the
 * phone number on the sign-in screen.
 *
 * The one module besides src/lib/env.ts permitted to read import.meta.env (S1.5 AC6): Sentry
 * must be up before env.ts parses, so that a malformed environment is itself reported.
 */
export const sentryOptions: Sentry.BrowserOptions = {
  dsn: import.meta.env.VITE_SENTRY_DSN,
  enabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
  release: import.meta.env.VITE_SENTRY_RELEASE,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'production',
  // `sendDefaultPii: false` is deprecated in SDK v10 in favour of this, which is stricter: no
  // automatic user fields, no cookies, no headers, no bodies, no query strings. The scrubber
  // is the backstop for what the SDK still sends and for anything a call site sets by hand.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
  },
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
}

/**
 * Called once from main.tsx before the first render. With no DSN it does nothing, so a clean
 * checkout and a fork pull request both run (AC1). `overrides` exists for the test that points
 * the real init at a fake transport; production passes nothing.
 */
export function initSentry(overrides: Partial<Sentry.BrowserOptions> = {}): void {
  const options: Sentry.BrowserOptions = { ...sentryOptions, ...overrides }
  if (!options.enabled) return
  Sentry.init(options)
  // Solely so the once-per-release check (AC3) can be run from a console on a minified build:
  // `window.__pfcSentry.captureException(new Error('sentry smoke'))`. One function, no
  // configuration; the DSN it could reveal is already a public value in the bundle. The
  // alternative, a throw-on-purpose route, is rejected in D16.
  ;(window as Window & { __pfcSentry?: unknown }).__pfcSentry = {
    captureException: (error: unknown): string => Sentry.captureException(error),
  }
}

/**
 * The auth uuid and nothing else — never phone, never name (D16). S2.9 owns every call site.
 * `scripts/check-conventions.mjs` fails lint on any other `setUser(` under src/, so no caller
 * can widen the payload (AC10).
 */
export function setSentryUser(id: string | null): void {
  Sentry.setUser(id === null ? null : { id })
}
