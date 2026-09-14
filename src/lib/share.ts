/**
 * The one place `navigator.share` is called (S5.2). No React, so it is unit-testable with a
 * stubbed `navigator`. The app never sends a message itself: it hands the OS a string, or falls
 * back to a `wa.me` link that opens WhatsApp with the body prefilled. Nothing is queued, recorded
 * or retried, and `captureException` is never called from here — a failed share is a breadcrumb
 * and an inline line on screen, nothing more (D16, AC12).
 */
import * as Sentry from '@sentry/react'
import { waMeUrl } from '@/lib/shareMessage'

export type ShareMethod = 'native' | 'wa.me' | 'clipboard'

export type ShareOutcome =
  | { status: 'shared'; method: ShareMethod }
  | { status: 'cancelled' } // user dismissed the sheet — say nothing
  | { status: 'failed' } // nothing worked — the caller shows the inline line

/** A share breadcrumb carries only the transport, never the message body or an event id (AC12,
 *  D16). Exported so the copy fallback in `ShareButton` can record its own `'clipboard'` use. */
export function shareBreadcrumb(method: ShareMethod): void {
  Sentry.addBreadcrumb({
    category: 'share',
    message: 'share.invoked',
    level: 'info',
    data: { method },
  })
}

/** `navigator.share` is gated on a secure context and is absent on plain `http://` origins other
 *  than localhost. Both facts are true, so the `wa.me` path covers the gap (spec gotchas). Do not
 *  gate on `navigator.canShare`: some Android builds return false for text-only shares that then
 *  succeed. */
export function canShareNatively(): boolean {
  return typeof navigator.share === 'function' && window.isSecureContext
}

/**
 * Share `message`. Caller must have prevented the default navigation only when
 * `canShareNatively()` is true (see `ShareButton`), so the user gesture is still live here (AC4).
 *
 * 1. Native sheet resolves → `shared: 'native'`.
 * 2. `AbortError` (the user dismissed it) → `cancelled`, silently (AC5).
 * 3. Any other rejection → navigate to `waMeUrl(message)` in the same tap → `shared: 'wa.me'`.
 * 4. If even that throws → `failed`; the caller offers the copy control (AC6).
 */
export async function shareText(message: string): Promise<ShareOutcome> {
  if (canShareNatively()) {
    try {
      await navigator.share({ text: message })
      shareBreadcrumb('native')
      return { status: 'shared', method: 'native' }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { status: 'cancelled' }
      }
      // Fall through to the wa.me transport below.
    }
  }
  try {
    window.location.assign(waMeUrl(message))
    shareBreadcrumb('wa.me')
    return { status: 'shared', method: 'wa.me' }
  } catch {
    return { status: 'failed' }
  }
}
