import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearIntendedRoute, setIntendedRoute, takeIntendedRoute } from '@/lib/intended-route'

const KEY = 'pfc.intendedRoute'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('setIntendedRoute / takeIntendedRoute (AC6)', () => {
  it('round-trips a path through the {path, at} envelope', () => {
    setIntendedRoute('/history')
    const raw = localStorage.getItem(KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw ?? '{}') as { path: string; at: number }
    expect(parsed.path).toBe('/history')
    expect(typeof parsed.at).toBe('number')
    expect(takeIntendedRoute()).toBe('/history')
  })

  it('keeps the query string on the path', () => {
    setIntendedRoute('/event/abc?ref=wa')
    expect(takeIntendedRoute()).toBe('/event/abc?ref=wa')
  })

  it.each(['/login', '/register', '/join/tok123', '/reset/tok123'])(
    'ignores the waypoint %s on write',
    (path) => {
      setIntendedRoute(path)
      expect(localStorage.getItem(KEY)).toBeNull()
      expect(takeIntendedRoute()).toBeNull()
    },
  )

  it('take removes the key (single use)', () => {
    setIntendedRoute('/history')
    expect(takeIntendedRoute()).toBe('/history')
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(takeIntendedRoute()).toBeNull()
  })

  it('reads malformed JSON as absent', () => {
    localStorage.setItem(KEY, 'not json{')
    expect(takeIntendedRoute()).toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('reads a well-formed envelope missing its path as absent', () => {
    localStorage.setItem(KEY, JSON.stringify({ at: 1 }))
    expect(takeIntendedRoute()).toBeNull()
  })
})

describe('degrades when localStorage throws', () => {
  it('setIntendedRoute swallows a throwing setItem', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => {
      setIntendedRoute('/history')
    }).not.toThrow()
  })

  it('takeIntendedRoute returns null when getItem throws', () => {
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
