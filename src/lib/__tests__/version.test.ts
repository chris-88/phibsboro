import { afterEach, describe, expect, it } from 'vitest'
import { LOCAL_VERSION, getAppVersion } from '@/lib/version'

function setRelease(content: string | undefined) {
  document.querySelector('meta[name="pfc-release"]')?.remove()
  if (content === undefined) return
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'pfc-release')
  meta.setAttribute('content', content)
  document.head.appendChild(meta)
}

describe('getAppVersion (AC14)', () => {
  afterEach(() => {
    setRelease(undefined)
  })

  it('returns the first seven characters of the commit SHA', () => {
    setRelease('e8b15154a2c9d7f0b3e6a1c4d5f6e7a8b9c0d1e2')
    expect(getAppVersion()).toBe('e8b1515')
  })

  it("returns 'local' when the tag is unsubstituted, as in `npm run dev` without an env file", () => {
    setRelease('%VITE_SENTRY_RELEASE%')
    expect(getAppVersion()).toBe(LOCAL_VERSION)
  })

  it("returns 'local' for .env.example's literal", () => {
    setRelease('local')
    expect(getAppVersion()).toBe(LOCAL_VERSION)
  })

  it("returns 'local' when the tag is absent or empty", () => {
    expect(getAppVersion()).toBe(LOCAL_VERSION)
    setRelease('')
    expect(getAppVersion()).toBe(LOCAL_VERSION)
  })

  it('never throws, even with no document', () => {
    expect(getAppVersion(undefined)).toBe(LOCAL_VERSION)
    const broken = {
      querySelector: () => {
        throw new Error('boom')
      },
    }
    expect(getAppVersion(broken)).toBe(LOCAL_VERSION)
  })

  // AC16 — the value follows the tag, so two builds with different releases render differently.
  it('changes between two builds carrying different release strings', () => {
    setRelease('aaaaaaa1111')
    const a = getAppVersion()
    setRelease('bbbbbbb2222')
    const b = getAppVersion()
    expect(a).toBe('aaaaaaa')
    expect(b).toBe('bbbbbbb')
    expect(a).not.toBe(b)
  })
})
