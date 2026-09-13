import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearPendingJoin, readPendingJoin, setPendingJoin } from '@/features/auth/pending-join'

const KEY = 'pfc.pendingJoin'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('pendingJoin round-trip (AC10)', () => {
  it('stores and reads a token join', () => {
    setPendingJoin({ kind: 'token', token: 'abc' })
    expect(readPendingJoin()).toEqual({ kind: 'token', token: 'abc' })
  })

  it('stores and reads an event join', () => {
    setPendingJoin({ kind: 'event', eventId: 'e1' })
    expect(readPendingJoin()).toEqual({ kind: 'event', eventId: 'e1' })
  })

  it('clears', () => {
    setPendingJoin({ kind: 'token', token: 'abc' })
    clearPendingJoin()
    expect(readPendingJoin()).toBeNull()
  })
})

describe('pendingJoin expiry and corruption (AC11)', () => {
  it('ignores a join older than 24 hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T00:00:00Z'))
    setPendingJoin({ kind: 'token', token: 'abc' })
    vi.setSystemTime(new Date('2026-09-14T00:00:01Z')) // 24h + 1s later
    expect(readPendingJoin()).toBeNull()
  })

  it('keeps a join just under 24 hours old', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-13T00:00:00Z'))
    setPendingJoin({ kind: 'token', token: 'abc' })
    vi.setSystemTime(new Date('2026-09-13T23:59:59Z'))
    expect(readPendingJoin()).toEqual({ kind: 'token', token: 'abc' })
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json')
    expect(readPendingJoin()).toBeNull()
  })

  it('returns null for a well-formed but wrong-shaped record', () => {
    localStorage.setItem(KEY, JSON.stringify({ kind: 'token', savedAt: Date.now() }))
    expect(readPendingJoin()).toBeNull()
  })

  it('degrades to null when localStorage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readPendingJoin()).toBeNull()
  })

  it('degrades silently when localStorage throws on write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(() => {
      setPendingJoin({ kind: 'token', token: 'abc' })
    }).not.toThrow()
  })
})
