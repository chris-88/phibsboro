import { createHashRouter } from 'react-router'
import { routes } from '@/routes'

/**
 * The one router instance, in its own module so code that runs *above* the React tree can reach
 * it. S2.6's session teardown fires from the auth subscription, not from a component, so it has no
 * `useNavigate()`; it calls `router.navigate('/login')` here instead (D59). Everything else imports
 * the same instance, so there is exactly one router.
 *
 * HashRouter, never BrowserRouter: GitHub Pages serves static files, so every deep link fetches
 * `index.html` and the app's own route lives after the `#` (CLAUDE.md §2).
 */
export const router = createHashRouter(routes)

/**
 * The app's current route as a router path, e.g. `/history` or `/event/abc`, read straight from the
 * fragment. Empty fragment returns `/`. Never an absolute URL — `setIntendedRoute` rejects one
 * anyway (S2.5 AC10) — and it strips the leading `#` HashRouter owns. Used by the expiry teardown to
 * remember where the player was before the refresh failed.
 */
export function currentHashPath(): string {
  const hash = window.location.hash
  if (hash === '' || hash === '#') return '/'
  const path = hash.slice(1)
  return path.startsWith('/') ? path : `/${path}`
}
