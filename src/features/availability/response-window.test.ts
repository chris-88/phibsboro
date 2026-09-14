import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { responseWindow } from '@/features/availability/response-window'

// The clock the hook trusts, driven by the test. serverNow() is S3.3's; the pure function reads no
// clock, so its own tests need none of this.
let mockNowMs = 0
vi.mock('@/lib/serverClock', () => ({
  serverNow: () => new Date(mockNowMs),
}))

const { useResponseWindow } = await import('@/features/availability/use-response-window')

// A Saturday-evening kick-off in Dublin winter (GMT), so 19:30Z is 7.30pm and the AC4 copy is exact.
const STARTS_AT = '2026-03-14T19:30:00.000Z'
const START_MS = Date.parse(STARTS_AT)
const scheduled = { status: 'scheduled' as const, starts_at: STARTS_AT }
const cancelled = { status: 'cancelled' as const, starts_at: STARTS_AT }

describe('responseWindow (S3.4)', () => {
  it('is open one second before starts_at', () => {
    expect(responseWindow(scheduled, new Date(START_MS - 1000))).toEqual({ open: true })
  })

  it('is shut exactly at starts_at, matching the policy `>` with `<=` (AC6)', () => {
    expect(responseWindow(scheduled, new Date(START_MS))).toMatchObject({
      open: false,
      reason: 'started',
    })
  })

  it('is shut one second after starts_at, with the verbatim line (AC4)', () => {
    expect(responseWindow(scheduled, new Date(START_MS + 1000))).toEqual({
      open: false,
      reason: 'started',
      message: 'Too late now. This started Sat 14 Mar, 7.30pm.',
    })
  })

  it('reads "This one\'s off." for a cancelled future event (AC5)', () => {
    expect(responseWindow(cancelled, new Date(START_MS - 1000))).toEqual({
      open: false,
      reason: 'cancelled',
      message: "This one's off.",
    })
  })

  it('cancelled beats started: a cancelled past event still reads "This one\'s off." (AC5)', () => {
    expect(responseWindow(cancelled, new Date(START_MS + 1000))).toEqual({
      open: false,
      reason: 'cancelled',
      message: "This one's off.",
    })
  })
})

describe('useResponseWindow (S3.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('flips from open to started at kick-off with no refetch (AC8)', () => {
    mockNowMs = START_MS - 5000 // five seconds out
    const { result } = renderHook(() => useResponseWindow(scheduled))
    expect(result.current).toEqual({ open: true })

    act(() => {
      mockNowMs = START_MS + 1000 // the clock moves past kick-off
      vi.advanceTimersByTime(6000) // and the armed timer fires
    })
    expect(result.current).toMatchObject({ open: false, reason: 'started' })
  })

  it('arms no timer when starts_at is eight hours away (outside the six-hour clamp)', () => {
    mockNowMs = START_MS - 8 * 60 * 60 * 1000
    const spy = vi.spyOn(globalThis, 'setTimeout')
    renderHook(() => useResponseWindow(scheduled))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('arms no timer for a cancelled event', () => {
    mockNowMs = START_MS - 5000
    const spy = vi.spyOn(globalThis, 'setTimeout')
    renderHook(() => useResponseWindow(cancelled))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
