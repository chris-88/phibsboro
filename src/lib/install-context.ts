/**
 * The install-context rules, as pure functions with no DOM, no React and no timers (S2.7, D45).
 * The provider owns the `beforeinstallprompt` listener and the 3-second Android window; these two
 * functions own the classification, so the rules are testable without a browser.
 */

/** One value per page load. Resolved once and never flipped under the player's thumb (D45). */
export type InstallContext =
  | 'resolving' // Android, still inside the 3s beforeinstallprompt window
  | 'standalone' // already installed. Show nothing, ever (D44)
  | 'ios-inapp' // iOS WhatsApp or another non-Safari webview → this story's prompt
  | 'android-inapp' // no beforeinstallprompt inside the window → this story's prompt
  | 'installable' // beforeinstallprompt captured → S2.8's Install button
  | 'ios-safari' // real iOS Safari → S2.8's written steps
  | 'other' // desktop, or anything unrecognised. Show nothing

/**
 * True for a WhatsApp iOS webview, and for any iOS WebKit view with no Safari UI marker — the
 * generic in-app case a webview leaves behind when it drops its own token. Written as two clauses
 * on purpose (open question 3): if WhatsApp ever stops stamping `WhatsApp`, the second still
 * catches it, and the fix is one fixture row. Android is deliberately absent: there a Chrome Custom
 * Tab *is* Chrome, sharing its session, so the UA cannot and must not classify it (D45).
 */
export function detectIosInAppWebview(ua: string): boolean {
  const isIos = /iPhone|iPad|iPod/.test(ua)
  if (!isIos) return false
  if (/WhatsApp/i.test(ua)) return true
  const isWebKit = ua.includes('AppleWebKit')
  const hasSafariUi = ua.includes('Safari/')
  const isOtherRealBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isWebKit && !hasSafariUi && !isOtherRealBrowser
}

/**
 * The classification, given the three inputs the provider gathers. `standalone` wins over
 * everything (D44). iOS resolves synchronously — it never fires `beforeinstallprompt`, so
 * `installPromptSeen` is irrelevant there. Android is decided solely by whether the event fired
 * inside the window (D45, AC2); the UA is never consulted for it. Never returns `resolving`: that
 * state belongs to the provider's timer, not to a rule.
 */
export function resolveInstallContext(input: {
  ua: string
  standalone: boolean
  installPromptSeen: boolean
}): InstallContext {
  if (input.standalone) return 'standalone'
  if (/iPhone|iPad|iPod/.test(input.ua)) {
    return detectIosInAppWebview(input.ua) ? 'ios-inapp' : 'ios-safari'
  }
  if (input.ua.includes('Android')) {
    return input.installPromptSeen ? 'installable' : 'android-inapp'
  }
  return 'other'
}
