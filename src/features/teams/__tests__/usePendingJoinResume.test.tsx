import { StrictMode, type ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import { AppError } from '@/lib/errors'

/** A mutation whose `mutate` calls back synchronously with a scripted outcome. */
function scriptedMutation(outcome: 'success' | Error) {
  const mutate = vi.fn(
    (_vars: string, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
      if (outcome === 'success') opts?.onSuccess?.()
      else opts?.onError?.(outcome)
    },
  )
  return { mutate, isPending: false }
}

const hoisted = vi.hoisted(() => ({
  joinByToken: { value: { mutate: vi.fn(), isPending: false } },
  joinByEvent: { value: { mutate: vi.fn(), isPending: false } },
  readPendingJoin: vi.fn(),
  clearPendingJoin: vi.fn(),
  lookup: { value: { data: undefined as { team_name: string } | undefined } },
}))

vi.mock('@/api/joins', () => ({
  useJoinTeamByToken: () => hoisted.joinByToken.value,
  useJoinTeamByEvent: () => hoisted.joinByEvent.value,
}))
vi.mock('@/api/invites', () => ({ useInviteLookup: () => hoisted.lookup.value }))
vi.mock('@/features/auth/pending-join', () => ({
  readPendingJoin: hoisted.readPendingJoin,
  clearPendingJoin: hoisted.clearPendingJoin,
}))

const { usePendingJoinResume } = await import('@/features/teams/usePendingJoinResume')

const signedIn: SessionState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }
const signedOut: SessionState = { status: 'signedOut', session: null }

function wrapperFor(session: SessionState, initialPath = '/') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <StrictMode>
        <SessionContext.Provider value={session}>
          <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
        </SessionContext.Provider>
      </StrictMode>
    )
  }
}

beforeEach(() => {
  hoisted.joinByToken.value = { mutate: vi.fn(), isPending: false }
  hoisted.joinByEvent.value = { mutate: vi.fn(), isPending: false }
  hoisted.lookup.value = { data: undefined }
  hoisted.readPendingJoin.mockReset()
  hoisted.clearPendingJoin.mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('usePendingJoinResume (S2.4)', () => {
  it('returns done immediately when there is no pending join (registration path)', async () => {
    hoisted.readPendingJoin.mockReturnValue(null)
    const { result } = renderHook(() => usePendingJoinResume(), { wrapper: wrapperFor(signedIn) })
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(hoisted.joinByToken.value.mutate).not.toHaveBeenCalled()
  })

  it('does nothing while signed out — an anonymous visitor keeps their pending join', () => {
    hoisted.readPendingJoin.mockReturnValue({ kind: 'token', token: 'tok' })
    const { result } = renderHook(() => usePendingJoinResume(), { wrapper: wrapperFor(signedOut) })
    expect(result.current.status).toBe('idle')
    expect(hoisted.joinByToken.value.mutate).not.toHaveBeenCalled()
  })

  it('fires the token join exactly once under strict mode and clears on success (AC14)', async () => {
    hoisted.readPendingJoin.mockReturnValue({ kind: 'token', token: 'tok' })
    hoisted.joinByToken.value = scriptedMutation('success')
    const { result } = renderHook(() => usePendingJoinResume(), { wrapper: wrapperFor(signedIn) })
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(hoisted.joinByToken.value.mutate).toHaveBeenCalledTimes(1)
    expect(hoisted.joinByToken.value.mutate).toHaveBeenCalledWith('tok', expect.anything())
    expect(hoisted.clearPendingJoin).toHaveBeenCalledTimes(1)
  })

  it('fires the event join for an event pending join (AC13)', async () => {
    hoisted.readPendingJoin.mockReturnValue({ kind: 'event', eventId: 'ev1' })
    hoisted.joinByEvent.value = scriptedMutation('success')
    const { result } = renderHook(() => usePendingJoinResume(), { wrapper: wrapperFor(signedIn) })
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(hoisted.joinByEvent.value.mutate).toHaveBeenCalledWith('ev1', expect.anything())
    expect(hoisted.clearPendingJoin).toHaveBeenCalledTimes(1)
  })

  it('clears the key on a dead link (AC14)', async () => {
    hoisted.readPendingJoin.mockReturnValue({ kind: 'token', token: 'tok' })
    hoisted.joinByToken.value = scriptedMutation(new AppError('invalid_invite'))
    const { result } = renderHook(() => usePendingJoinResume(), { wrapper: wrapperFor(signedIn) })
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(hoisted.clearPendingJoin).toHaveBeenCalledTimes(1)
  })

  it('keeps the key on a network failure so a retry still works (AC14)', async () => {
    hoisted.readPendingJoin.mockReturnValue({ kind: 'token', token: 'tok' })
    hoisted.joinByToken.value = scriptedMutation(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => usePendingJoinResume(), { wrapper: wrapperFor(signedIn) })
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(hoisted.clearPendingJoin).not.toHaveBeenCalled()
  })

  it('defers on a waypoint route so the registration join is not doubled', () => {
    hoisted.readPendingJoin.mockReturnValue({ kind: 'token', token: 'tok' })
    hoisted.joinByToken.value = scriptedMutation('success')
    const { result } = renderHook(() => usePendingJoinResume(), {
      wrapper: wrapperFor(signedIn, '/register'),
    })
    expect(result.current.status).toBe('idle')
    expect(hoisted.joinByToken.value.mutate).not.toHaveBeenCalled()
  })

  it('exposes the team name from the lookup while a token join is in flight (AC16)', async () => {
    hoisted.readPendingJoin.mockReturnValue({ kind: 'token', token: 'tok' })
    // A mutation that never settles, so status stays joining.
    hoisted.joinByToken.value = { mutate: vi.fn(), isPending: true }
    hoisted.lookup.value = { data: { team_name: 'Firsts' } }
    const { result } = renderHook(() => usePendingJoinResume(), { wrapper: wrapperFor(signedIn) })
    await waitFor(() => {
      expect(result.current.status).toBe('joining')
    })
    expect(result.current.teamName).toBe('Firsts')
  })
})
