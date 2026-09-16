import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn<(fn: string) => Promise<{ data: null; error: null }>>()
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (fn: string) => rpc(fn) } }))

const { useLastSeen } = await import('@/features/auth/use-last-seen')

beforeEach(() => {
  rpc.mockClear()
  localStorage.clear()
})

describe('useLastSeen (S18.6)', () => {
  it('stamps last-active on mount when the user is signed in', () => {
    renderHook(() => {
      useLastSeen(true, '/')
    })
    expect(rpc).toHaveBeenCalledWith('touch_last_seen')
  })

  it('does nothing for a signed-out / cold visitor', () => {
    renderHook(() => {
      useLastSeen(false, '/')
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('throttles: a navigation inside the window does not stamp again', () => {
    const { rerender } = renderHook(
      ({ path }) => {
        useLastSeen(true, path)
      },
      {
        initialProps: { path: '/' },
      },
    )
    expect(rpc).toHaveBeenCalledTimes(1)
    rerender({ path: '/stats' }) // navigate within the throttle window
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('stamps again once the throttle window has elapsed', () => {
    // Seed the last-touch well in the past so the next navigation is due.
    localStorage.setItem('pfc.lastSeenTouch', String(Date.now() - 60 * 60 * 1000))
    const { rerender } = renderHook(
      ({ path }) => {
        useLastSeen(true, path)
      },
      {
        initialProps: { path: '/' },
      },
    )
    expect(rpc).toHaveBeenCalledTimes(1)
    // That first touch reset the window, so an immediate navigation does not re-stamp.
    rerender({ path: '/stats' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
