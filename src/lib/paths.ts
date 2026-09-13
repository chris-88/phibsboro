import { env } from '@/lib/env'

/**
 * Every in-app route path, and the only builder of absolute links. This is the one file in
 * `src/` allowed to contain the literal `'/#/'` — `scripts/check-conventions.mjs` enforces
 * that, so the hash never leaks into a screen and the base URL is never concatenated at a
 * call site (S0.3 AC8, D13).
 */
export const paths = {
  home: () => '/',
  login: () => '/login',
  register: () => '/register',
  join: (token: string) => `/join/${token}`,
  reset: (token: string) => `/reset/${token}`,
  event: (id: string) => `/event/${id}`,
  history: () => '/history',
  manage: () => '/manage',
  newEvent: () => '/manage/event/new',
  manageEvent: (id: string) => `/manage/event/${id}`,
  teamMembers: (teamId: string) => `/manage/team/${teamId}/members`,
  admin: () => '/admin',
} as const

/** Thrown rather than returning a relative `"/#/event/x"` that would look right in a test
 *  and go nowhere from a WhatsApp message. `env.ts` already refuses a base that is not a URL
 *  at startup (S1.5 AC6); this guards the one shape a URL parser accepts and a link cannot use. */
export class BaseUrlMissingError extends Error {
  constructor() {
    super('VITE_APP_BASE_URL is not set; absolute links cannot be built')
    this.name = 'BaseUrlMissingError'
  }
}

/** Absolute, shareable, includes the hash. `VITE_APP_BASE_URL` may be given with or without a
 *  trailing slash — `https://app.phibsboro.ie` or `https://chris-88.github.io/phibsboro/` —
 *  and the result never carries a double slash or a trailing one. */
export function absoluteUrl(path: string): string {
  const base = env.VITE_APP_BASE_URL.trim().replace(/\/+$/, '')
  if (base === '') throw new BaseUrlMissingError()
  return `${base}/#/${path.replace(/^\/+/, '')}`
}

export const eventUrl = (id: string): string => absoluteUrl(paths.event(id))
export const joinUrl = (token: string): string => absoluteUrl(paths.join(token))
export const resetUrl = (token: string): string => absoluteUrl(paths.reset(token))
