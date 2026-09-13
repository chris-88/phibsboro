import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkLockout, recordFailure, recordSuccess } from '@/features/auth/sign-in-lockout'

const A = '+353871234567'
const B = '+353899999010'
const T0 = 1_000_000_000_000

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('recordFailure / checkLockout across the five-strike window (AC6)', () => {
  it('does not lock at four failures and locks at the fifth for 30s', () => {
    for (let i = 1; i <= 4; i++) {
      const state = recordFailure(A, T0 + i)
      expect(state.failures).toBe(i)
      expect(state.lockedUntil).toBeNull()
    }
    const fifth = recordFailure(A, T0 + 5)
    expect(fifth.failures).toBe(5)
    expect(fifth.lockedUntil).toBe(T0 + 5 + 30_000)
  })

  it('stays locked on a sixth failure inside the window', () => {
    for (let i = 1; i <= 5; i++) recordFailure(A, T0)
    const sixth = recordFailure(A, T0 + 10)
    expect(sixth.failures).toBe(6)
    expect(sixth.lockedUntil).toBe(T0 + 10 + 30_000)
  })

  it('reads as locked right up to the boundary and clear one ms after', () => {
    recordFailure(A, T0)
    for (let i = 0; i < 4; i++) recordFailure(A, T0)
    const lockedUntil = checkLockout(A, T0).lockedUntil
    expect(lockedUntil).toBe(T0 + 30_000)
    expect(checkLockout(A, T0 + 30_000).lockedUntil).toBeNull() // window elapsed, button re-enables
    expect(checkLockout(A, T0 + 29_999).lockedUntil).toBe(T0 + 30_000)
  })

  it('restarts the count as a fresh window after a lock elapses', () => {
    for (let i = 0; i < 5; i++) recordFailure(A, T0)
    // 30s later the window has passed; the next failure is failure one again, not six.
    const next = recordFailure(A, T0 + 31_000)
    expect(next.failures).toBe(1)
    expect(next.lockedUntil).toBeNull()
  })
})

describe('per-number isolation and success reset (AC6)', () => {
  it('locks one number without touching another', () => {
    for (let i = 0; i < 5; i++) recordFailure(A, T0)
    expect(checkLockout(A, T0).lockedUntil).not.toBeNull()
    expect(checkLockout(B, T0).lockedUntil).toBeNull()
    expect(checkLockout(B, T0).failures).toBe(0)
  })

  it('clears the counter for a number on a successful sign-in', () => {
    for (let i = 0; i < 5; i++) recordFailure(A, T0)
    recordSuccess(A)
    expect(checkLockout(A, T0)).toEqual({ failures: 0, lockedUntil: null })
  })

  it('survives a reload: state lives in localStorage, not memory (AC7)', () => {
    for (let i = 0; i < 5; i++) recordFailure(A, T0)
    // A fresh read with no in-memory state still sees the lock.
    expect(checkLockout(A, T0).lockedUntil).toBe(T0 + 30_000)
  })
})

describe('degrades safely on corrupt or unavailable storage', () => {
  it('treats corrupt JSON as no lock', () => {
    localStorage.setItem('pfc.signInLockout', '{not json')
    expect(checkLockout(A, T0)).toEqual({ failures: 0, lockedUntil: null })
    // and a subsequent failure starts cleanly from one.
    expect(recordFailure(A, T0).failures).toBe(1)
  })

  it('does not throw when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => checkLockout(A, T0)).not.toThrow()
    expect(checkLockout(A, T0)).toEqual({ failures: 0, lockedUntil: null })
  })

  it('does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(() => recordFailure(A, T0)).not.toThrow()
  })

  it('prunes entries untouched for more than an hour on the next write', () => {
    recordFailure(A, T0)
    // A different number failing an hour and a bit later prunes A's stale entry.
    recordFailure(B, T0 + 60 * 60 * 1000 + 1)
    expect(checkLockout(A, T0 + 60 * 60 * 1000 + 1).failures).toBe(0)
    expect(checkLockout(B, T0 + 60 * 60 * 1000 + 1).failures).toBe(1)
  })
})
