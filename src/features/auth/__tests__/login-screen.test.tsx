import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import { AuthFailure } from '@/lib/auth'
import type { UseMutateFunction } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'

type MutateOpts = Parameters<UseMutateFunction<void, AuthFailure, unknown>>[1]

const hoisted = vi.hoisted(() => ({ mutate: vi.fn(), pending: { value: false } }))
vi.mock('@/api/auth', () => ({
  useSignIn: () => ({ mutate: hoisted.mutate, isPending: hoisted.pending.value }),
}))

const LoginScreen = (await import('@/features/auth/login-screen')).default
const PHONE = '+353871234567'
const LOCKOUT_KEY = 'pfc.signInLockout'

const signedOut: SessionState = { status: 'signedOut', session: null }
const loading: SessionState = { status: 'loading', session: null }
const signedIn: SessionState = { status: 'signedIn', session: { user: { id: 'u1' } } as Session }

function renderScreen(session: SessionState = signedOut, state?: { phone: string }) {
  return render(
    <SessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<div>register screen</div>} />
          <Route path="/" element={<div>home screen</div>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

async function submit(phone: string, password: string): Promise<MutateOpts> {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Mobile number'), phone)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  return hoisted.mutate.mock.calls.at(-1)?.[1] as MutateOpts
}

beforeEach(() => {
  localStorage.clear()
  hoisted.mutate.mockReset()
  hoisted.pending.value = false
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('AC1 — two inputs and one submit button, nothing else takes input', () => {
  it('renders exactly two inputs and a single submit button', () => {
    renderScreen()
    const form = document.querySelector('form')
    expect(form).not.toBeNull()
    expect(form?.querySelectorAll('input')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute('type', 'submit')
    // The show/hide toggle is a button but not a submit and takes no text input.
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('type', 'button')
  })

  it('gives the number a numeric keypad and both fields their autofill hints (layout)', () => {
    renderScreen()
    const phone = screen.getByLabelText('Mobile number')
    expect(phone).toHaveAttribute('type', 'tel')
    expect(phone).toHaveAttribute('inputmode', 'tel')
    expect(phone).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
  })
})

describe('AC5 — recovery copy is text, not a link', () => {
  it('shows the ask-your-manager line and no forgot-password link', () => {
    renderScreen()
    expect(
      screen.getByText('Forgotten your password? Ask your manager to send you a reset link.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /forgot/i })).toBeNull()
  })
})

describe('AC11 — a signed-in visitor is redirected, never shown the form', () => {
  it('renders home instead of the form', () => {
    renderScreen(signedIn)
    expect(screen.getByText('home screen')).toBeInTheDocument()
    expect(document.querySelector('form')).toBeNull()
  })
})

describe('session still restoring shows a skeleton, not the form (UI states)', () => {
  it('renders no form while loading', () => {
    renderScreen(loading)
    expect(document.querySelector('form')).toBeNull()
    expect(screen.queryByText('home screen')).toBeNull()
  })
})

describe('AC3 / AC4 — a wrong password keeps the number, clears the password, moves focus', () => {
  it('shows the non-distinguishing line and clears only the password', async () => {
    renderScreen()
    const opts = await submit('0871234567', 'wrongpass')
    ;(opts?.onError as ((e: AuthFailure) => void) | undefined)?.(
      new AuthFailure('invalid_credentials'),
    )
    expect(await screen.findByText('That number and password don’t match.')).toBeInTheDocument()
    expect(screen.getByLabelText('Mobile number')).toHaveValue('0871234567')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveFocus()
  })
})

describe('AC12 — a network failure shows its own line and keeps the number', () => {
  it('renders the network line, not the credentials line', async () => {
    renderScreen()
    const opts = await submit('0871234567', 'whatever')
    ;(opts?.onError as ((e: AuthFailure) => void) | undefined)?.(new AuthFailure('network'))
    expect(await screen.findByText('Couldn’t reach the server. Try again.')).toBeInTheDocument()
    expect(screen.queryByText('That number and password don’t match.')).toBeNull()
    expect(screen.getByLabelText('Mobile number')).toHaveValue('0871234567')
  })
})

describe('AC10 — a success navigates home with replace', () => {
  it('lands on home', async () => {
    renderScreen()
    const opts = await submit('0871234567', 'phibsboro-seed-1234')
    ;(opts?.onSuccess as (() => void) | undefined)?.()
    expect(await screen.findByText('home screen')).toBeInTheDocument()
  })
})

describe('AC6 / AC7 — a persisted lockout disables submit with a countdown', () => {
  it('disables the button and shows the delay line for the locked number', async () => {
    const now = Date.now()
    localStorage.setItem(
      LOCKOUT_KEY,
      JSON.stringify({ [PHONE]: { failures: 5, lockedUntil: now + 30_000, at: now } }),
    )
    renderScreen()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Mobile number'), '0871234567')
    await user.type(screen.getByLabelText('Password'), 'phibsboro-seed-1234')
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    expect(screen.getByText(/Too many tries\. Try again in \d+s\./)).toBeInTheDocument()
  })
})

describe('AC9 — prefill from the registration link focuses the password', () => {
  it('prefills the number and puts focus on the password field', () => {
    renderScreen(signedOut, { phone: '0871234567' })
    expect(screen.getByLabelText('Mobile number')).toHaveValue('0871234567')
    expect(screen.getByLabelText('Password')).toHaveFocus()
  })

  it('prefills from the last number used on this browser when no link state', () => {
    localStorage.setItem('pfc.lastPhone', PHONE)
    renderScreen()
    expect(screen.getByLabelText('Mobile number')).toHaveValue(PHONE)
  })
})

describe('Create account link only shows with a pending join', () => {
  it('is absent without a pending join', () => {
    renderScreen()
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull()
  })

  it('is present, pointing at register, with a pending join', () => {
    localStorage.setItem(
      'pfc.pendingJoin',
      JSON.stringify({ kind: 'token', token: 'tok', savedAt: Date.now() }),
    )
    renderScreen()
    expect(within(document.body).getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/register',
    )
  })
})
