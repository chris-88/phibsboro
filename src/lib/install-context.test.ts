import { describe, expect, it } from 'vitest'
import { USER_AGENT_FIXTURES } from '@/lib/__fixtures__/user-agents'
import {
  detectIosInAppWebview,
  resolveInstallContext,
  type InstallContext,
} from '@/lib/install-context'

const uaFor = (label: string): string => {
  const row = USER_AGENT_FIXTURES.find((f) => f.label === label)
  if (!row) throw new Error(`no fixture labelled ${label}`)
  return row.ua
}

describe('detectIosInAppWebview (AC1)', () => {
  it.each(USER_AGENT_FIXTURES)('$label → $iosInApp', ({ ua, iosInApp }) => {
    expect(detectIosInAppWebview(ua)).toBe(iosInApp)
  })

  it('is true for WhatsApp iOS and for an iOS WebKit UA with no Safari token', () => {
    expect(detectIosInAppWebview(uaFor('WhatsApp iOS'))).toBe(true)
    expect(detectIosInAppWebview(uaFor('iOS WKWebView, no Safari token'))).toBe(true)
  })

  it('is false for iOS Safari, iOS Chrome, iOS Firefox, Android Chrome and desktop Chrome', () => {
    for (const label of [
      'iOS Safari',
      'iOS Chrome (CriOS)',
      'iOS Firefox (FxiOS)',
      'Android Chrome',
      'Desktop Chrome',
    ]) {
      expect(detectIosInAppWebview(uaFor(label))).toBe(false)
    }
  })
})

describe('resolveInstallContext', () => {
  const IOS_WHATSAPP = uaFor('WhatsApp iOS')
  const IOS_SAFARI = uaFor('iOS Safari')
  const ANDROID = uaFor('Android Chrome')
  const DESKTOP = uaFor('Desktop Chrome')

  it('lets standalone win over every other combination (AC3)', () => {
    for (const ua of [IOS_WHATSAPP, IOS_SAFARI, ANDROID, DESKTOP]) {
      for (const installPromptSeen of [true, false]) {
        expect(resolveInstallContext({ ua, standalone: true, installPromptSeen })).toBe(
          'standalone',
        )
      }
    }
  })

  it('classifies iOS synchronously, ignoring installPromptSeen', () => {
    for (const installPromptSeen of [true, false]) {
      expect(
        resolveInstallContext({ ua: IOS_WHATSAPP, standalone: false, installPromptSeen }),
      ).toBe('ios-inapp')
      expect(resolveInstallContext({ ua: IOS_SAFARI, standalone: false, installPromptSeen })).toBe(
        'ios-safari',
      )
    }
  })

  it('gives android-inapp when no prompt fired and installable when it did (AC2)', () => {
    expect(
      resolveInstallContext({ ua: ANDROID, standalone: false, installPromptSeen: false }),
    ).toBe<InstallContext>('android-inapp')
    expect(
      resolveInstallContext({ ua: ANDROID, standalone: false, installPromptSeen: true }),
    ).toBe<InstallContext>('installable')
  })

  it('decides Android on the event alone, never the UA (AC2)', () => {
    // A WhatsApp-shaped token on an Android UA changes nothing: the event is the only signal.
    const androidWithWhatsApp = `${ANDROID} WhatsApp/2.24.1`
    expect(
      resolveInstallContext({
        ua: androidWithWhatsApp,
        standalone: false,
        installPromptSeen: true,
      }),
    ).toBe('installable')
    expect(
      resolveInstallContext({
        ua: androidWithWhatsApp,
        standalone: false,
        installPromptSeen: false,
      }),
    ).toBe('android-inapp')
  })

  it('returns other for desktop and anything unrecognised', () => {
    expect(
      resolveInstallContext({ ua: DESKTOP, standalone: false, installPromptSeen: false }),
    ).toBe('other')
    expect(resolveInstallContext({ ua: '', standalone: false, installPromptSeen: false })).toBe(
      'other',
    )
  })
})
