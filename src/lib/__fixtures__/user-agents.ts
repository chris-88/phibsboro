/**
 * Real user-agent strings, one row per capture, with a provenance comment naming the app and OS
 * version each came from (S2.7 definition of done). `detectIosInAppWebview` is asserted against
 * every row. When WhatsApp changes its UA, the fix is one row here plus one test case, and nothing
 * else moves — the whole reason the detector is pure and this table is separate.
 */
export interface UserAgentFixture {
  /** The app and OS the string was captured from. */
  label: string
  ua: string
  /** Expected `detectIosInAppWebview(ua)`. */
  iosInApp: boolean
}

export const USER_AGENT_FIXTURES: readonly UserAgentFixture[] = [
  {
    // WhatsApp in-app webview, iOS 16.6, WhatsApp 2.23.20.79 — carries the `WhatsApp` token.
    label: 'WhatsApp iOS',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.23.20.79 A',
    iosInApp: true,
  },
  {
    // A bare WKWebView on iOS 17.4: WebKit, no `Safari/` UI marker, no browser token. The generic
    // in-app case the second detector clause exists for (open question 3).
    label: 'iOS WKWebView, no Safari token',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    iosInApp: true,
  },
  {
    // Real Mobile Safari, iOS 17.5.1 — the `Safari/604.1` marker rules it out.
    label: 'iOS Safari',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    iosInApp: false,
  },
  {
    // Chrome on iOS 17.5 — `CriOS`. A real browser with its own session; never the escape prompt.
    label: 'iOS Chrome (CriOS)',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    iosInApp: false,
  },
  {
    // Firefox on iOS 17.5 — `FxiOS`.
    label: 'iOS Firefox (FxiOS)',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15',
    iosInApp: false,
  },
  {
    // Edge on iOS 17.5 — `EdgiOS`. Guarded so the second clause never misfires on a real browser.
    label: 'iOS Edge (EdgiOS)',
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 EdgiOS/126.0.0.0 Mobile/15E148 Safari/604.1',
    iosInApp: false,
  },
  {
    // Chrome on Android 14, Pixel 7 — not iOS, so the iOS detector is false and D45's Android path
    // takes over via beforeinstallprompt, not the UA.
    label: 'Android Chrome',
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.54 Mobile Safari/537.36',
    iosInApp: false,
  },
  {
    // Desktop Chrome on Windows 10 — not iOS.
    label: 'Desktop Chrome',
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.54 Safari/537.36',
    iosInApp: false,
  },
]
