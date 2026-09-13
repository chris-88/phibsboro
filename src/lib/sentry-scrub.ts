/**
 * PII scrubbing for everything that leaves for Sentry (D16, D62). Pure, no Sentry import, so it
 * unit tests without the SDK. The phone number is the account identifier, so it turns up in form
 * state, auth request URLs and breadcrumbs; join and reset tokens are bearer credentials. A false
 * positive here costs a digit run in an error report; a false negative is a data leak that cannot
 * be unsent, so every pattern errs wide.
 */

const TOKEN_PATH = /(\/#\/(?:join|reset)\/)[^/?#\s"']+/g // the hash form, wherever it appears
const E164 = /\+\d{8,15}/g // +353871234567
const ENCODED_E164 = /%2B\d{8,15}/gi // +353871234567 after URL encoding in a query string
const SPACED_E164 = /\+\d{1,3}(?:[ -]\d{2,4}){2,4}/g // +353 87 123 4567
const IE_NATIONAL = /\b0\d{2}[ -]?\d{3}[ -]?\d{3,4}\b/g // 087 123 4567, 0871234567
// 353871234567 — how Supabase Auth stores and returns a phone, with no plus. Also 00353… .
const BARE_DIGITS = /\b\d{9,15}\b/g

export const PHONE_MASK = '[phone]'
export const TOKEN_MASK = '[token]'

const MAX_DEPTH = 8

/** Token rule first, so a token containing digits is never half-masked as a phone number. */
export function scrubString(input: string): string {
  return input
    .replace(TOKEN_PATH, `$1${TOKEN_MASK}`)
    .replace(E164, PHONE_MASK)
    .replace(ENCODED_E164, PHONE_MASK)
    .replace(SPACED_E164, PHONE_MASK)
    .replace(IE_NATIONAL, PHONE_MASK)
    .replace(BARE_DIGITS, PHONE_MASK)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Walks strings, arrays and plain objects, returning a scrubbed copy of the same shape. Anything
 * else — numbers, Dates, Errors, class instances — is returned as is. Depth is capped and a seen
 * set guards cycles, so a pathological `extra` cannot hang the SDK (AC12).
 */
export function scrubDeep<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return scrubString(value) as T
  if (depth >= MAX_DEPTH || typeof value !== 'object' || value === null) return value
  if (seen.has(value)) return value
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item: unknown) => scrubDeep(item, depth + 1, seen)) as T
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) out[key] = scrubDeep(item, depth + 1, seen)
    return out as T
  }
  return value
}

// Structural, every field optional, so Sentry's own ErrorEvent and Breadcrumb assign to these
// without a cast and the tests need no SDK types.
export interface BreadcrumbLike {
  type?: string
  category?: string
  message?: string
  data?: Record<string, unknown>
}

export interface SentryEventLike {
  message?: string
  transaction?: string
  exception?: { values?: { type?: string; value?: string }[] }
  request?: { url?: string; data?: unknown; headers?: Record<string, string> }
  extra?: Record<string, unknown>
  tags?: Record<string, unknown>
  contexts?: Record<string, unknown>
  breadcrumbs?: BreadcrumbLike[]
  user?: { id?: string | number }
}

/**
 * `beforeSend`. Scrubs every text-bearing field and reduces `user` to `{ id }`, whatever set it.
 * Stack frames are left alone so Sentry still groups issues (AC11). Never returns null: dropping
 * an event loses the bug, and scrubbing is what makes keeping it safe.
 */
export function scrubEvent<T extends SentryEventLike>(event: T): T {
  const out: T = { ...event }
  const e: SentryEventLike = out

  if (e.message !== undefined) e.message = scrubString(e.message)
  if (e.transaction !== undefined) e.transaction = scrubString(e.transaction)
  if (e.exception?.values) {
    e.exception = {
      ...e.exception,
      values: e.exception.values.map((v) =>
        v.value === undefined ? v : { ...v, value: scrubString(v.value) },
      ),
    }
  }
  if (e.request) {
    e.request = {
      ...e.request,
      ...(e.request.url === undefined ? {} : { url: scrubString(e.request.url) }),
      ...(e.request.data === undefined ? {} : { data: scrubDeep(e.request.data) }),
      ...(e.request.headers === undefined ? {} : { headers: scrubDeep(e.request.headers) }),
    }
  }
  if (e.extra) e.extra = scrubDeep(e.extra)
  if (e.tags) e.tags = scrubDeep(e.tags)
  if (e.contexts) e.contexts = scrubDeep(e.contexts)
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map((crumb) => scrubBreadcrumb(crumb))
  if (e.user) e.user = e.user.id === undefined ? {} : { id: e.user.id }

  return out
}

const AUTH_PATH = '/auth/v1/'

/**
 * `beforeBreadcrumb`. Scrubs the crumb, and for a `fetch` or `xhr` crumb against Supabase Auth
 * keeps only `method` and `status_code`: that request carries the number and the password.
 */
export function scrubBreadcrumb<T extends BreadcrumbLike>(crumb: T): T {
  const out: T = { ...crumb }
  const c: BreadcrumbLike = out

  if (c.message !== undefined) c.message = scrubString(c.message)
  if (c.data) {
    const url = c.data.url
    const isAuth =
      (c.category === 'fetch' || c.category === 'xhr') &&
      typeof url === 'string' &&
      url.includes(AUTH_PATH)
    c.data = isAuth ? pick(c.data, ['method', 'status_code']) : scrubDeep(c.data)
  }
  return out
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) if (key in source) out[key] = source[key]
  return out
}
