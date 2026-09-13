import { takeIntendedRoute } from '@/lib/intended-route'
import { paths } from '@/lib/paths'

/**
 * Where to send a user the instant they are signed in. This is the warm path of the deep-link
 * return (S2.5): a form submit in a live document — registration (S2.1), sign-in (S2.2) and a
 * signed-in join (S2.4) all call it after a successful `signUp` / `signInWithPassword`. It
 * consumes the intended route the S2.9 guard or the S3.3 affordances stored, and falls back to
 * home when there is none.
 *
 * `takeIntendedRoute()` clears on read (AC8), so this and the cold-start hook
 * (`useIntendedRoute`) cannot double-navigate: whichever runs first consumes the value and the
 * other gets `null`.
 */
export function nextRouteAfterAuth(): string {
  return takeIntendedRoute() ?? paths.home()
}
