import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({
  redeem: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as { kind: string } | null,
  },
  toast: vi.fn(),
  captured: [] as unknown[],
}))

vi.mock('@/api/reset', () => ({
  useRedeemResetToken: () => hoisted.redeem,
}))
vi.mock('sonner', () => ({
  toast: (msg: string) => {
    hoisted.toast(msg)
  },
}))
vi.mock('@sentry/react', () => ({
  captureException: (e: unknown) => hoisted.captured.push(e),
  captureMessage: (m: unknown) => hoisted.captured.push(m),
}))

const ResetPasswordScreen = (await import('@/features/auth/ResetPasswordScreen')).default

const TOKEN = 'aB3-dE5_fG7hJ9kL1mN3pQ5rS7tU9vW1xY3z'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/reset/${TOKEN}`]}>
      <Routes>
        <Route path="/reset/:token" element={<ResetPasswordScreen />} />
        <Route path="/login" element={<div>login screen</div>} />
        <Route path="/" element={<div>home screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hoisted.redeem.mutate.mockReset()
  hoisted.redeem.isPending = false
  hoisted.redeem.isError = false
  hoisted.redeem.error = null
  hoisted.toast.mockReset()
  hoisted.captured.length = 0
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('ResetPasswordScreen', () => {
  it('renders the set-password form without validating the token first (AC9)', () => {
    renderScreen()
    expect(screen.getByRole('heading', { name: 'Pick a new password' })).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(hoisted.redeem.mutate).not.toHaveBeenCalled()
  })

  it('blocks submit for a password under 8 characters (AC10)', async () => {
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Save password' }))
    expect(hoisted.redeem.mutate).not.toHaveBeenCalled()
  })

  it('redeems and lands home on success, with a confirmation (AC11)', async () => {
    hoisted.redeem.mutate.mockImplementation(
      (vars: { token: string }, opts: { onSuccess: (r: { signedIn: boolean }) => void }) => {
        expect(vars.token).toBe(TOKEN)
        opts.onSuccess({ signedIn: true })
      },
    )
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('New password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Save password' }))

    expect(await screen.findByText('home screen')).toBeInTheDocument()
    expect(hoisted.toast).toHaveBeenCalledWith('Password changed.')
  })

  it('finishes at sign-in when redeem succeeds but auto sign-in fails', async () => {
    hoisted.redeem.mutate.mockImplementation(
      (_vars: unknown, opts: { onSuccess: (r: { signedIn: boolean }) => void }) => {
        opts.onSuccess({ signedIn: false })
      },
    )
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('New password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Save password' }))

    expect(await screen.findByText('Sign in with your new password.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows the one dead-link screen for an invalid token (AC12)', () => {
    hoisted.redeem.isError = true
    hoisted.redeem.error = { kind: 'invalid_token' }
    renderScreen()
    expect(screen.getByText("That link's expired or already been used.")).toBeInTheDocument()
    expect(screen.getByText('Ask your manager for a new one.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows a retry line for a network or unknown failure, form still usable', () => {
    hoisted.redeem.isError = true
    hoisted.redeem.error = { kind: 'network' }
    renderScreen()
    expect(screen.getByText('Couldn’t do that. Try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save password' })).toBeEnabled()
  })

  it('never hands the token to Sentry (AC15)', async () => {
    hoisted.redeem.mutate.mockImplementation(
      (_vars: unknown, opts: { onSuccess: (r: { signedIn: boolean }) => void }) => {
        opts.onSuccess({ signedIn: false })
      },
    )
    const user = userEvent.setup()
    renderScreen()
    await user.type(screen.getByLabelText('New password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Save password' }))
    await screen.findByText('Sign in with your new password.')

    const serialised = JSON.stringify(hoisted.captured)
    expect(serialised).not.toContain(TOKEN)
    // Not asserting zero captures in general, only that no captured payload carries the token.
  })
})
