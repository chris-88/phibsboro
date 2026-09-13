import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const order: string[] = []

const signOutMock = vi.fn<() => Promise<{ error: unknown }>>()
const navigateMock = vi.fn(() => {
  order.push('navigate')
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: () => signOutMock() } },
}))
vi.mock('@/features/auth/session-context', () => ({
  tearDownSession: () => order.push('tearDownSession'),
}))
vi.mock('@/lib/intended-route', () => ({
  clearIntendedRoute: () => order.push('clearIntendedRoute'),
}))
vi.mock('sonner', () => ({ toast: () => order.push('toast') }))
vi.mock('react-router', () => ({ useNavigate: () => navigateMock }))

const { useSignOut } = await import('@/features/auth/use-sign-out')
const { paths } = await import('@/lib/paths')

beforeEach(() => {
  order.length = 0
  signOutMock.mockReset()
  navigateMock.mockClear()
})

describe('useSignOut (AC11)', () => {
  it('signs out, then tears down and lands on /login, in order', async () => {
    signOutMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useSignOut())

    await act(async () => {
      await result.current.signOut()
    })

    expect(order).toEqual(['tearDownSession', 'clearIntendedRoute', 'navigate'])
    expect(navigateMock).toHaveBeenCalledWith(paths.login(), { replace: true })
    // No toast on the happy path.
    expect(order).not.toContain('toast')
  })

  it('still tears down and navigates when signOut() rejects', async () => {
    signOutMock.mockResolvedValue({ error: { message: 'network' } })
    const { result } = renderHook(() => useSignOut())

    await act(async () => {
      await result.current.signOut()
    })

    expect(order).toContain('toast')
    expect(order).toContain('tearDownSession')
    expect(order).toContain('clearIntendedRoute')
    expect(navigateMock).toHaveBeenCalledWith(paths.login(), { replace: true })
  })
})
