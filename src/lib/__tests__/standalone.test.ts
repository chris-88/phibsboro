import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStandalone } from '@/lib/standalone'

// The only file besides src/lib/standalone.ts allowed to name the media query or the iOS
// flag (scripts/check-conventions.mjs, AC9).
function mediaMatches(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: matches && query === '(display-mode: standalone)',
        media: query,
      }) as MediaQueryList,
  )
}

function iosStandalone(value: boolean | undefined) {
  Object.defineProperty(navigator, 'standalone', { value, configurable: true })
}

describe('isStandalone (AC9, D44)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    iosStandalone(undefined)
  })

  it('is true when display-mode: standalone matches (Android, desktop)', () => {
    mediaMatches(true)
    expect(isStandalone()).toBe(true)
  })

  it('is true on iOS, where the media query is false but navigator.standalone is set', () => {
    mediaMatches(false)
    iosStandalone(true)
    expect(isStandalone()).toBe(true)
  })

  it('is false in a browser tab', () => {
    mediaMatches(false)
    iosStandalone(false)
    expect(isStandalone()).toBe(false)
  })

  it('is false where the iOS flag is absent entirely', () => {
    mediaMatches(false)
    expect(isStandalone()).toBe(false)
  })
})
