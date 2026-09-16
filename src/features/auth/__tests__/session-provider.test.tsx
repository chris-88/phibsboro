import type { Session } from '@supabase/supabase-js'
import { render, screen, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * S2.6's boot contract, with a mocked Supabase client and a mocked router (the real router would
 * pull the whole route tree and, more to the point, the thing under test is the provider, not the
 * client's own refresh). The client's `autoRefreshToken` does the token work; here `getSession()`
 * resolves the session the client hands back, and the provider's job is to (a) never bounce a
 * restored session to `/login`, (b) read the session exactly once on boot, (c) tell a deliberate
 * sign-out from an expiry, and (d) coalesce a rapid resume into one `getSession()`.
 */

type AuthListener = (event: string, session: Session | null) => void

const h = vi.hoisted(() => {
  const listeners: AuthListener[] = []
  return {
    listeners,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb: AuthListener) => {
      listeners.push(cb)
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    navigate: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: h.getSession, onAuthStateChange: h.onAuthStateChange } },
  authOptions: {},
}))

vi.mock('@/app/router', () => ({
  router: { navigate: h.navigate },
  // The route the player was on when the refresh failed; the expiry path remembers it (AC10).
  currentHashPath: () => '/profile',
}))

import { queryClient } from '@/api/queryClient'
import { consumeExpiryNotice } from '@/features/auth/expiry-notice'
import { SessionProvider } from '@/features/auth/session-provider'
import { useSession } from '@/features/auth/session-context'
import { markSignOutRequested } from '@/features/auth/sign-out-intent'

function StatusProbe(): React.JSX.Element {
  return <span data-testid="status">{useSession().status}</span>
}

function renderProvider(): void {
  render(
    <SessionProvider>
      <StatusProbe />
    </SessionProvider>,
  )
}

/** A session whose access token expired `hoursAgo` ago — what a stored session looks like after a
 *  long background, before the client refreshes it. */
function expiredSession(hoursAgo: number): Session {
  const nowSec = Math.floor(Date.now() / 1000)
  return {
    access_token: 'stub',
    refresh_token: 'stub',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSec - hoursAgo * 3600,
    user: { id: 'u1' },
  } as unknown as Session
}

function emit(event: string, session: Session | null): void {
  act(() => {
    for (const l of h.listeners) l(event, session)
  })
}

let clearSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  h.listeners.length = 0
  h.getSession.mockReset()
  h.navigate.mockReset()
  h.onAuthStateChange.mockClear()
  // Drain module-level flags left by a previous test.
  consumeExpiryNotice()
  localStorage.clear()
  clearSpy = vi.spyOn(queryClient, 'clear').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('restoring a stored session (AC5, AC6, AC17)', () => {
  it('restores an hour-expired session to signedIn with no navigation to /login', async () => {
    h.getSession.mockResolvedValue({ data: { session: expiredSession(2) } })
    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signedIn')
    })
    expect(h.getSession).toHaveBeenCalledTimes(1) // one read on boot, no storm
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it("restores a 25-hour-expired session the same way — the 24-hour claim's proxy (AC17)", async () => {
    h.getSession.mockResolvedValue({ data: { session: expiredSession(25) } })
    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signedIn')
    })
    // A TOKEN_REFRESHED after boot is the client's silent refresh; still no bounce.
    emit('TOKEN_REFRESHED', expiredSession(0))
    expect(screen.getByTestId('status').textContent).toBe('signedIn')
    expect(h.navigate).not.toHaveBeenCalled()
  })

  it('starts in loading, never an optimistic signedOut (AC7)', () => {
    h.getSession.mockReturnValue(new Promise(() => undefined)) // never resolves
    renderProvider()
    expect(screen.getByTestId('status').textContent).toBe('loading')
  })
})

describe('getSession rejecting at cold start', () => {
  it('resolves to signedOut without navigating', async () => {
    h.getSession.mockRejectedValue(new Error('offline'))
    renderProvider()

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signedOut')
    })
    expect(h.navigate).not.toHaveBeenCalled()
  })
})

describe('SIGNED_OUT teardown (AC10, AC11)', () => {
  beforeEach(() => {
    h.getSession.mockResolvedValue({ data: { session: expiredSession(1) } })
  })

  it('a deliberate sign-out clears the cache and does not keep an intended route', async () => {
    renderProvider()
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signedIn')
    })
    localStorage.setItem('pfc.intendedRoute', JSON.stringify({ path: '/profile', at: Date.now() }))

    markSignOutRequested()
    emit('SIGNED_OUT', null)

    expect(screen.getByTestId('status').textContent).toBe('signedOut')
    expect(clearSpy).toHaveBeenCalled()
    expect(localStorage.getItem('pfc.intendedRoute')).toBeNull() // cleared, not kept
    expect(consumeExpiryNotice()).toBe(false) // no expiry copy on a deliberate sign-out
    expect(h.navigate).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('an expiry keeps the current route and raises the notice', async () => {
    renderProvider()
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('signedIn')
    })

    emit('SIGNED_OUT', null) // no sign-out requested → genuine expiry

    expect(clearSpy).toHaveBeenCalled()
    const stored = JSON.parse(localStorage.getItem('pfc.intendedRoute') ?? '{}') as {
      path?: string
    }
    expect(stored.path).toBe('/profile') // currentHashPath(), so S2.5 returns them
    expect(consumeExpiryNotice()).toBe(true)
    expect(h.navigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})

describe('resume after a long background (AC12)', () => {
  it('coalesces two rapid visibility events into one getSession()', async () => {
    vi.useFakeTimers()
    h.getSession.mockResolvedValue({ data: { session: expiredSession(1) } })
    renderProvider()
    await vi.waitFor(() => {
      expect(h.getSession).toHaveBeenCalledTimes(1) // the boot read
    })

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      document.dispatchEvent(new Event('visibilitychange'))
      vi.advanceTimersByTime(300)
    })

    // Boot read plus exactly one debounced resume read — not two.
    expect(h.getSession).toHaveBeenCalledTimes(2)
  })
})
