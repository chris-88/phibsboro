import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()
let currentPath = '/'
const takeMock = vi.fn<() => string | null>()

vi.mock('react-router', () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: currentPath }),
}))
vi.mock('@/lib/intended-route', () => ({
  takeIntendedRoute: () => takeMock(),
}))

const { useIntendedRoute } = await import('@/features/auth/use-intended-route')

beforeEach(() => {
  navigateMock.mockClear()
  takeMock.mockReset()
  currentPath = '/'
})

describe('useIntendedRoute (the cold-start path)', () => {
  it('navigates once, with replace, to the stored route when enabled', () => {
    takeMock.mockReturnValue('/event/abc')
    renderHook(() => {
      useIntendedRoute(true)
    })
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith('/event/abc', { replace: true })
  })

  it('does not navigate while disabled, and leaves the value unread', () => {
    takeMock.mockReturnValue('/event/abc')
    renderHook(() => {
      useIntendedRoute(false)
    })
    expect(takeMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not navigate when the value was already consumed (take returns null)', () => {
    takeMock.mockReturnValue(null)
    renderHook(() => {
      useIntendedRoute(true)
    })
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('does not navigate when already on the stored path', () => {
    currentPath = '/event/abc'
    takeMock.mockReturnValue('/event/abc')
    renderHook(() => {
      useIntendedRoute(true)
    })
    // Consumed, but no redundant navigation (AC12).
    expect(takeMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('consumes exactly once even if re-rendered while enabled', () => {
    takeMock.mockReturnValue('/event/abc')
    const { rerender } = renderHook(() => {
      useIntendedRoute(true)
    })
    rerender()
    rerender()
    expect(takeMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledTimes(1)
  })
})
