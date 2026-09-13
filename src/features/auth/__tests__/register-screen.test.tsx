import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import { AuthFailure } from '@/lib/auth'
import type { UseMutateFunction } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'

type MutateOpts = Parameters<UseMutateFunction<{ teamName: string }, AuthFailure, unknown>>[1]

const hoisted = vi.hoisted(() => {
  interface QueryLike {
    data: { team_name: string } | null | undefined
    isLoading: boolean
    isError: boolean
    refetch: () => void
  }
  const idle = (): QueryLike => ({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: () => undefined,
  })
  return {
    invite: { value: idle() },
    event: { value: idle() },
    mutate: vi.fn(),
    pending: { value: false },
  }
})

vi.mock('@/api/invites', () => ({ useInviteLookup: () => hoisted.invite.value }))
vi.mock('@/api/events', () => ({ useEventPreview: () => hoisted.event.value }))
vi.mock('@/api/auth', () => ({
  useRegister: () => ({ mutate: hoisted.mutate, isPending: hoisted.pending.value }),
}))

const RegisterScreen = (await import('@/features/auth/register-screen')).default

const signedOut: SessionState = { status: 'signedOut', session: null }
const signedIn: SessionState = {
  status: 'signedIn',
  session: { user: { id: 'u1' } } as Session,
}

function renderScreen(session: SessionState = signedOut) {
  return render(
    <SessionContext.Provider value={session}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterScreen />} />
          <Route path="/login" element={<div>sign in screen</div>} />
          <Route path="/" element={<div>home screen</div>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

/** Types a valid three-field form and submits, then fires the mutation callback the test wants. */
async function submitValid(): Promise<MutateOpts> {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Your name'), 'Aoife Byrne')
  await user.type(screen.getByLabelText('Mobile number'), '0871234567')
  await user.type(screen.getByLabelText('Password'), 'longenough')
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  const call = hoisted.mutate.mock.calls.at(-1)
  return call?.[1] as MutateOpts
}

beforeEach(() => {
  localStorage.clear()
  hoisted.invite.value = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }
  hoisted.event.value = { data: undefined, isLoading: false, isError: false, refetch: vi.fn() }
  hoisted.mutate.mockReset()
  hoisted.pending.value = false
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('AC1 — no pending join renders the dead-link screen, no form', () => {
  it('shows the LinkProblem copy and a Sign in button, and no inputs', () => {
    renderScreen()
    expect(screen.getByText("That link isn't working.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
    expect(document.querySelector('form')).toBeNull()
  })
})

describe('AC2 / AC3 — arriving from a token names the team and shows three inputs', () => {
  beforeEach(() => {
    localStorage.setItem(
      'pfc.pendingJoin',
      JSON.stringify({ kind: 'token', token: 'tok', savedAt: Date.now() }),
    )
    hoisted.invite.value = {
      data: { team_name: 'Firsts' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }
  })

  it('names the team from the lookup', () => {
    renderScreen()
    expect(screen.getByText('Firsts')).toBeInTheDocument()
    expect(screen.getByText(/You’re joining/)).toBeInTheDocument()
  })

  it('has exactly three inputs inside the form', () => {
    renderScreen()
    const form = document.querySelector('form')
    expect(form).not.toBeNull()
    expect(within(form as HTMLElement).getAllByRole('textbox')).toHaveLength(2) // name + tel
    expect(form?.querySelectorAll('input')).toHaveLength(3) // + password (not a textbox role)
  })

  it('gives the mobile field a numeric keypad and tel autofill (AC5)', () => {
    renderScreen()
    const phone = screen.getByLabelText('Mobile number')
    expect(phone).toHaveAttribute('type', 'tel')
    expect(phone).toHaveAttribute('inputmode', 'tel')
    expect(phone).toHaveAttribute('autocomplete', 'tel')
  })
})

describe('AC8 — a duplicate number offers sign-in, no Postgres text', () => {
  beforeEach(() => {
    localStorage.setItem(
      'pfc.pendingJoin',
      JSON.stringify({ kind: 'token', token: 'tok', savedAt: Date.now() }),
    )
    hoisted.invite.value = {
      data: { team_name: 'Firsts' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }
  })

  it('renders the plain sentence and a prefilled Sign in link', async () => {
    renderScreen()
    const opts = await submitValid()
    ;(opts?.onError as ((e: AuthFailure) => void) | undefined)?.(new AuthFailure('duplicate_phone'))
    expect(await screen.findByText('That number is already registered.')).toBeInTheDocument()
    expect(screen.queryByText(/duplicate key/)).toBeNull()
    expect(
      within(screen.getByRole('alert')).getByRole('link', { name: 'Sign in' }),
    ).toHaveAttribute('href', '/login')
  })
})

describe('AC9 — a dead link after the account is created lands on LinkProblem with a way home', () => {
  beforeEach(() => {
    localStorage.setItem(
      'pfc.pendingJoin',
      JSON.stringify({ kind: 'token', token: 'tok', savedAt: Date.now() }),
    )
    hoisted.invite.value = {
      data: { team_name: 'Firsts' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }
  })

  it('swaps to the dead-link screen with Go to home', async () => {
    renderScreen()
    const opts = await submitValid()
    ;(opts?.onError as ((e: AuthFailure) => void) | undefined)?.(new AuthFailure('invalid_invite'))
    expect(await screen.findByText("That link isn't working.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to home' })).toBeInTheDocument()
  })
})

describe('lookup states', () => {
  beforeEach(() => {
    localStorage.setItem(
      'pfc.pendingJoin',
      JSON.stringify({ kind: 'token', token: 'tok', savedAt: Date.now() }),
    )
  })

  it('shows the form with submit disabled while the lookup is loading', () => {
    hoisted.invite.value = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() }
    renderScreen()
    expect(document.querySelector('form')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('shows an inline retry when the lookup errors', () => {
    hoisted.invite.value = { data: undefined, isLoading: false, isError: true, refetch: vi.fn() }
    renderScreen()
    expect(screen.getByText("Couldn't check that link.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('treats a null lookup (dead token) as the dead-link screen', () => {
    hoisted.invite.value = { data: null, isLoading: false, isError: false, refetch: vi.fn() }
    renderScreen()
    expect(screen.getByText("That link isn't working.")).toBeInTheDocument()
    expect(document.querySelector('form')).toBeNull()
  })
})

describe('AC12 — the button locks while the mutation is in flight', () => {
  it('disables submit and shows the pending label', () => {
    localStorage.setItem(
      'pfc.pendingJoin',
      JSON.stringify({ kind: 'token', token: 'tok', savedAt: Date.now() }),
    )
    hoisted.invite.value = {
      data: { team_name: 'Firsts' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }
    hoisted.pending.value = true
    renderScreen()
    const button = screen.getByRole('button', { name: 'Creating account…' })
    expect(button).toBeDisabled()
  })
})

describe('a signed-in visitor is redirected, never shown the form', () => {
  it('renders home instead of the register form', () => {
    localStorage.setItem(
      'pfc.pendingJoin',
      JSON.stringify({ kind: 'token', token: 'tok', savedAt: Date.now() }),
    )
    renderScreen(signedIn)
    expect(screen.getByText('home screen')).toBeInTheDocument()
    expect(document.querySelector('form')).toBeNull()
  })
})
