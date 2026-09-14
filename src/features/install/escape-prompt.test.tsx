import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { absoluteUrl, paths } from '@/lib/paths'
import { isDismissed } from '@/lib/prompt-dismissal'

const copyText = vi.fn<(text: string) => Promise<boolean>>()
vi.mock('@/lib/clipboard', () => ({ copyText: (t: string) => copyText(t) }))

const { EscapePrompt } = await import('@/features/install/escape-prompt')

const HOME_URL = absoluteUrl(paths.home())
const EVENT_URL = absoluteUrl(paths.event('9f1c'))

beforeEach(() => {
  copyText.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EscapePrompt', () => {
  it('is an inline status region, not a dialog (AC5)', () => {
    render(<EscapePrompt platform="ios-inapp" onDismiss={() => undefined} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the one line, naming the platform browser (AC6)', () => {
    const { rerender } = render(<EscapePrompt platform="ios-inapp" onDismiss={() => undefined} />)
    expect(
      screen.getByText("Open in Safari to add this to your home screen. You'll sign in once more."),
    ).toBeInTheDocument()
    rerender(<EscapePrompt platform="android-inapp" onDismiss={() => undefined} />)
    expect(
      screen.getByText("Open in Chrome to add this to your home screen. You'll sign in once more."),
    ).toBeInTheDocument()
  })

  it('copies the app root, never the event URL, and confirms (AC7)', async () => {
    const user = userEvent.setup()
    copyText.mockResolvedValue(true)
    render(<EscapePrompt platform="ios-inapp" onDismiss={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Copy link' }))

    expect(copyText).toHaveBeenCalledWith(HOME_URL)
    expect(copyText).not.toHaveBeenCalledWith(EVENT_URL)
    expect(HOME_URL).toMatch(/\/#\/$/)
    expect(screen.getByRole('button', { name: 'Link copied' })).toBeInTheDocument()
    expect(screen.getByText('Paste it into Safari.')).toBeInTheDocument()
  })

  it('reveals a selectable field holding the URL when the clipboard is unavailable (AC8)', async () => {
    const user = userEvent.setup()
    copyText.mockResolvedValue(false)
    render(<EscapePrompt platform="android-inapp" onDismiss={() => undefined} />)

    await user.click(screen.getByRole('button', { name: 'Copy link' }))

    const field = screen.getByLabelText('App link')
    expect(field).toHaveValue(HOME_URL)
    expect(field).toHaveAttribute('readonly')
    expect(
      screen.getByText("Copy didn't work. Tap and hold the link to copy it."),
    ).toBeInTheDocument()
    // The dead copy button is gone; the field replaces it.
    expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument()
  })

  it('writes the dismissal and calls onDismiss (AC9), via a labelled 44px control (AC12)', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<EscapePrompt platform="ios-inapp" onDismiss={onDismiss} />)

    const dismissBtn = screen.getByRole('button', { name: 'Not now' })
    // size="icon" maps to the size-tap (44px) floor from D40/A16.
    expect(dismissBtn.className).toContain('size-tap')

    await user.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledOnce()
    // Assert through the public API so the storage key literal stays owned by prompt-dismissal.ts (AC10).
    expect(isDismissed('escape')).toBe(true)
  })
})
