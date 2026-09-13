import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as LibAuth from '@/lib/auth'

const signIn = vi.fn()
vi.mock('@/lib/auth', async (importActual) => {
  const actual = await importActual<typeof LibAuth>()
  return { ...actual, signInWithIdentifier: signIn }
})

const { useSignIn } = await import('@/api/auth')
const { userKeys } = await import('@/api/queryKeys')
const { readPendingJoin, setPendingJoin } = await import('@/features/auth/pending-join')
const { checkLockout, recordFailure } = await import('@/features/auth/sign-in-lockout')
const { readLastPhone } = await import('@/features/auth/last-phone')
const { AuthFailure } = await import('@/lib/auth')

const PHONE = '+353871234567'

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

let client: QueryClient
beforeEach(() => {
  localStorage.clear()
  signIn.mockReset()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 0 } },
  })
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('useSignIn success (AC10, AC6)', () => {
  it('invalidates userKeys.current, remembers the number, and clears the lockout', async () => {
    signIn.mockResolvedValue({ session: {} })
    // A prior lockout on this number that a success must clear.
    for (let i = 0; i < 5; i++) recordFailure(PHONE, Date.now())
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    const { result } = renderHook(() => useSignIn(), { wrapper: wrapperFor(client) })
    result.current.mutate({ phone: PHONE, password: 'phibsboro-seed-1234' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(signIn).toHaveBeenCalledWith(PHONE, 'phibsboro-seed-1234')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: userKeys.current() })
    expect(readLastPhone()).toBe(PHONE)
    expect(checkLockout(PHONE, Date.now())).toEqual({ failures: 0, lockedUntil: null })
  })
})

describe('useSignIn leaves a pending join untouched (AC15)', () => {
  it('does not read, write or clear pfc.pendingJoin on success', async () => {
    signIn.mockResolvedValue({ session: {} })
    setPendingJoin({ kind: 'token', token: 'tok-123' })

    const { result } = renderHook(() => useSignIn(), { wrapper: wrapperFor(client) })
    result.current.mutate({ phone: PHONE, password: 'pw' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(readPendingJoin()).toEqual({ kind: 'token', token: 'tok-123' })
  })
})

describe('useSignIn failure', () => {
  it('surfaces the mapped AuthFailure and never remembers the number', async () => {
    signIn.mockRejectedValue(new AuthFailure('invalid_credentials'))

    const { result } = renderHook(() => useSignIn(), { wrapper: wrapperFor(client) })
    result.current.mutate({ phone: PHONE, password: 'wrong' })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.error?.kind).toBe('invalid_credentials')
    expect(readLastPhone()).toBeNull()
  })
})
