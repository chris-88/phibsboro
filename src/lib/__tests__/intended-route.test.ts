import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearIntendedRoute,
  isRestorableRoute,
  peekIntendedRoute,
  setIntendedRoute,
  takeIntendedRoute,
} from '@/lib/intended-route'

const KEY = 'pfc.intendedRoute'

afterEach(() => {
  localStorage.clear()
  // The in-memory fallback survives between tests; drain it so cases do not leak into each other.
  clearIntendedRoute()
  vi.restoreAllMocks()
})

describe('setIntendedRoute / takeIntendedRoute (AC4, AC8)', () => {
  it('round-trips a path through the {path, at} envelope', () => {
    setIntendedRoute('/profile')
    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw ?? '{}') as { path: string; at: number }
    expect(parsed.path).toBe('/profile')
    expect(typeof parsed.at).toBe('number')
    expect(takeIntendedRoute()).toBe('/profile')
  })

  it('keeps the query string on the path', () => {
    setIntendedRoute('/event/abc?ref=wa')
    expect(takeIntendedRoute()).toBe('/event/abc?ref=wa')
  })

  it('take removes the key (single use)', () => {
    setIntendedRoute('/profile')
    expect(takeIntendedRoute()).toBe('/profile')
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(takeIntendedRoute()).toBeNull()
  })

  it('reads malformed JSON as absent', () => {
    localStorage.setItem(KEY, 'not json{')
    expect(takeIntendedRoute()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('reads a well-formed envelope missing its path as absent', () => {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now() }))
    expect(takeIntendedRoute()).toBeNull()
  })
})

describe('peekIntendedRoute does not consume (boot gate)', () => {
  it('returns the value and leaves it in place for take', () => {
    setIntendedRoute('/profile')
    expect(peekIntendedRoute()).toBe('/profile')
    expect(peekIntendedRoute()).toBe('/profile')
    expect(takeIntendedRoute()).toBe('/profile')
    expect(peekIntendedRoute()).toBeNull()
  })
})

describe('the 60-minute TTL (AC11)', () => {
  it('discards a value older than 60 minutes on read', () => {
    const stale = { path: '/event/abc', at: Date.now() - (60 * 60 * 1000 + 1) }
    localStorage.setItem(KEY, JSON.stringify(stale))
    expect(peekIntendedRoute()).toBeNull()
    expect(takeIntendedRoute()).toBeNull()
  })

  it('keeps a value inside the window', () => {
    const fresh = { path: '/event/abc', at: Date.now() - 60 * 1000 }
    localStorage.setItem(KEY, JSON.stringify(fresh))
    expect(takeIntendedRoute()).toBe('/event/abc')
  })
})

describe('validation rejects unsafe or non-destination paths (AC9, AC10)', () => {
  const denied = [
    '//evil.com',
    'https://evil.example',
    'http://evil.example/event/abc',
    '/\\evil.com',
    '/login',
    '/register',
    '/join/abc',
    '/reset/abc',
    '/nope',
    '/manage/event', // partial, matches no pattern
    `/event/${'a'.repeat(600)}`, // over 512 characters
    'event/abc', // no leading slash
  ]

  it.each(denied)('isRestorableRoute is false for %s', (path) => {
    expect(isRestorableRoute(path)).toBe(false)
  })

  it.each(denied)('setIntendedRoute writes nothing for %s', (path) => {
    setIntendedRoute(path)
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(takeIntendedRoute()).toBeNull()
  })

  it.each(denied)('a poisoned stored %s is discarded on read', (path) => {
    // An attacker who can write localStorage cannot turn this into an open redirect.
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }))
    expect(peekIntendedRoute()).toBeNull()
    expect(takeIntendedRoute()).toBeNull()
  })

  const allowed = [
    '/',
    '/event/9f1c',
    '/profile',
    '/manage',
    '/manage/event/new',
    '/manage/event/abc',
    '/manage/team/t1/members',
    '/admin',
  ]

  it.each(allowed)('isRestorableRoute is true for the S0.3 destination %s', (path) => {
    expect(isRestorableRoute(path)).toBe(true)
  })
})

describe('degrades when localStorage throws (AC16)', () => {
  it('setIntendedRoute swallows a throwing setItem and keeps the value in memory', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => {
      setIntendedRoute('/profile')
    }).not.toThrow()
    // The in-memory fallback answers reads within the tab even though nothing was persisted.
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(takeIntendedRoute()).toBe('/profile')
  })

  it('takeIntendedRoute returns null when getItem throws and no memory copy exists', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(takeIntendedRoute()).toBeNull()
  })

  it('clearIntendedRoute swallows a throwing removeItem', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => {
      clearIntendedRoute()
    }).not.toThrow()
  })
})
