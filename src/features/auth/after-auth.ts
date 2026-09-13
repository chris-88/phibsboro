import { paths } from '@/lib/paths'

/**
 * Where to send a user the instant they are signed in. S2.5 replaces this body with the
 * intended-route restore (the deep-link return path). Until then it is home, so registration
 * and sign-in already route through the one function S2.5 will own, and nothing else changes
 * when it lands.
 */
export function nextRouteAfterAuth(): string {
  return paths.home()
}
