import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import type { TeamInviteLookup } from '@/features/teams/schema'
import { AppError } from '@/lib/errors'

const TEAM_ID = '00000000-0000-4000-8000-000000000001'

interface LookupValue {
  data: TeamInviteLookup | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
}
interface JoinValue {
  mutate: ReturnType<typeof vi.fn>
  isPending: boolean
  isError: boolean
  error: unknown
}
interface CurrentUserValue {
  status: string
  user?: { memberships: { teamId: string }[] }
}

const hoisted = vi.hoisted(() => {
  const lookupState = (data: TeamInviteLookup | null): LookupValue => ({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })
  const joinState = (): JoinValue => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  })
  const userState = (status: string, memberships: { teamId: string }[] = []): CurrentUserValue =>
    status === 'ready' ? { status, user: { memberships } } : { status }
  return {
    lookup: { value: lookupState(null) },
    join: { value: joinState() },
    currentUser: { value: userState('signedOut') },
    setPendingJoin: vi.fn(),
  }
})

vi.mock('@/api/invites', () => ({ useInviteLookup: () => hoisted.lookup.value }))
vi.mock('@/api/joins', () => ({ useJoinTeamByToken: () => hoisted.join.value }))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => hoisted.currentUser.value,
}))
vi.mock('@/features/auth/pending-join', () => ({ setPendingJoin: hoisted.setPendingJoin }))

const JoinByTokenScreen = (await import('@/features/teams/JoinByTokenScreen')).default

const invite = (role: 'player' | 'manager' = 'player'): TeamInviteLookup => ({
  team_id: TEAM_ID,
  team_name: 'Firsts',
  role,
})

const signedIn: SessionState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }
const signedOut: SessionState = { status: 'signedOut', session: null }

function readyUser(memberships: { teamId: string }[]) {
  return { status: 'ready', user: { memberships } }
}

function renderAt(session: SessionState, token = 'tok') {
  return render(
    <SessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[`/join/${token}`]}>
        <Routes>
          <Route path="/join/:token" element={<JoinByTokenScreen />} />
          <Route path="/register" element={<div>register screen</div>} />
          <Route path="/login" element={<div>login screen</div>} />
          <Route path="/" element={<div>home screen</div>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(() => {
  hoisted.lookup.value = { data: null, isLoading: false, isError: false, refetch: vi.fn() }
  hoisted.join.value = { mutate: vi.fn(), isPending: false, isError: false, error: null }
  hoisted.currentUser.value = { status: 'signedOut' }
  hoisted.setPendingJoin.mockReset()
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('JoinByTokenScreen — link states', () => {
  it('shows a checking state while the lookup runs', () => {
    hoisted.lookup.value = { ...hoisted.lookup.value, isLoading: true }
    renderAt(signedOut)
    expect(screen.getByRole('status', { name: 'Checking your link' })).toBeInTheDocument()
  })

  it('shows a retry when the lookup itself fails (D49)', async () => {
    const refetch = vi.fn()
    hoisted.lookup.value = { data: null, isLoading: false, isError: true, refetch }
    renderAt(signedOut)
    expect(screen.getByText("Couldn't check that link.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('renders the one dead-link screen when the lookup returns no rows (AC1, AC9)', () => {
    hoisted.lookup.value = { data: null, isLoading: false, isError: false, refetch: vi.fn() }
    renderAt(signedOut)
    expect(screen.getByRole('heading', { name: "That link's no good." })).toBeInTheDocument()
    expect(screen.getByText('Ask your manager for a new one.')).toBeInTheDocument()
  })
})

describe('JoinByTokenScreen — signed out (AC1, AC2)', () => {
  beforeEach(() => {
    hoisted.lookup.value = { data: invite(), isLoading: false, isError: false, refetch: vi.fn() }
  })

  it('names the team with no session and offers register and sign-in', () => {
    renderAt(signedOut)
    expect(screen.getByRole('heading', { name: 'Firsts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join Firsts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I already have an account' })).toBeInTheDocument()
  })

  it('writes the pending join before navigating to register', async () => {
    renderAt(signedOut)
    await userEvent.click(screen.getByRole('button', { name: 'Join Firsts' }))
    expect(hoisted.setPendingJoin).toHaveBeenCalledWith({ kind: 'token', token: 'tok' })
    expect(await screen.findByText('register screen')).toBeInTheDocument()
  })

  it('writes the pending join before navigating to sign in', async () => {
    renderAt(signedOut)
    await userEvent.click(screen.getByRole('button', { name: 'I already have an account' }))
    expect(hoisted.setPendingJoin).toHaveBeenCalledWith({ kind: 'token', token: 'tok' })
    expect(await screen.findByText('login screen')).toBeInTheDocument()
  })

  it('names the role only when the invite grants manager (open question 2)', () => {
    hoisted.lookup.value = {
      data: invite('manager'),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }
    renderAt(signedOut)
    expect(screen.getByText('You’ll join as a manager.')).toBeInTheDocument()
  })
})

describe('JoinByTokenScreen — signed in (AC5, AC20)', () => {
  beforeEach(() => {
    hoisted.lookup.value = { data: invite(), isLoading: false, isError: false, refetch: vi.fn() }
  })

  it('joins with one tap for a signed-in non-member (AC5)', async () => {
    hoisted.currentUser.value = readyUser([])
    renderAt(signedIn)
    const button = screen.getByRole('button', { name: 'Join Firsts' })
    await userEvent.click(button)
    expect(hoisted.join.value.mutate).toHaveBeenCalledWith('tok', expect.anything())
  })

  it('shows the already-in state with no join button for a member (AC20)', () => {
    hoisted.currentUser.value = readyUser([{ teamId: TEAM_ID }])
    renderAt(signedIn)
    expect(screen.getByText(/You’re already in,/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to home' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join Firsts' })).not.toBeInTheDocument()
    expect(hoisted.join.value.mutate).not.toHaveBeenCalled()
  })

  it('shows the dead-link screen when the join raises invalid_invite (AC9)', () => {
    hoisted.currentUser.value = readyUser([])
    hoisted.join.value = {
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new AppError('invalid_invite'),
    }
    renderAt(signedIn)
    expect(screen.getByRole('heading', { name: "That link's no good." })).toBeInTheDocument()
  })
})
