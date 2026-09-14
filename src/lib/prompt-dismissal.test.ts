import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismiss, isDismissed, markShown, wasShown } from '@/lib/prompt-dismissal'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('prompt-dismissal round trip', () => {
  it('starts not dismissed, and stays dismissed after a dismiss (AC9)', () => {
    expect(isDismissed('escape')).toBe(false)
    dismiss('escape')
    expect(isDismissed('escape')).toBe(true)
  })

  it('keeps the escape and install keys distinct', () => {
    dismiss('escape')
    expect(isDismissed('escape')).toBe(true)
    expect(isDismissed('install')).toBe(false)
  })

  it('tracks the install shown-once flag separately from dismissal', () => {
    expect(wasShown('install')).toBe(false)
    markShown('install')
    expect(wasShown('install')).toBe(true)
    expect(isDismissed('install')).toBe(false)
  })
})

describe('a localStorage that throws (private mode)', () => {
  it('treats a throwing store as not dismissed and never throws (AC9)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('access denied')
    })

    expect(isDismissed('escape')).toBe(false)
    expect(() => {
      dismiss('escape')
    }).not.toThrow()
    expect(isDismissed('escape')).toBe(false)
    expect(wasShown('install')).toBe(false)
    expect(() => {
      markShown('install')
    }).not.toThrow()
  })
})
