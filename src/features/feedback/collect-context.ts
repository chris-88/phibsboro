import type { FeedbackContext } from '@/features/feedback/schema'
import { isStandalone } from '@/lib/standalone'
import { getAppVersion } from '@/lib/version'

/**
 * The best-effort snapshot attached to a feedback report (W2): the route the reporter was on, the
 * running build (via `getAppVersion`, the one release-tag reader), the user agent, whether the app
 * is installed (via `isStandalone`, the one install-mode helper), and the viewport. `route` is
 * passed in — the caller reads it from the router — so this stays a pure-ish helper. Never throws: a
 * missing `window`/`navigator` (SSR, a locked-down webview) just omits that field, so a report is
 * always sendable.
 */
export function collectContext(route: string): FeedbackContext {
  const context: FeedbackContext = { route, release: getAppVersion() }
  try {
    if (typeof navigator !== 'undefined') context.user_agent = navigator.userAgent
    if (typeof window !== 'undefined') {
      context.viewport = `${String(window.innerWidth)}x${String(window.innerHeight)}`
    }
    // Last, because on a webview without matchMedia the helper can throw; keep the fields above.
    context.standalone = isStandalone()
  } catch {
    // Best effort — a partial context is fine, an unsent report is not.
  }
  return context
}
