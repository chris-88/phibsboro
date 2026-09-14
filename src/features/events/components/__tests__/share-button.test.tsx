import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShareButton } from '@/features/events/components/ShareButton'
import { waMeUrl } from '@/lib/shareMessage'

// A stand-in message; hash-route encoding is proved in shareMessage.test.ts, not needed here.
const MESSAGE =
  '🏃 Training\nSat 18 Jul, 6:30pm\nDalymount Park\n\nAre you available? https://app.example/e/1'

function setShare(value: unknown): void {
  Object.defineProperty(navigator, 'share', { value, configurable: true, writable: true })
}
function setSecureContext(value: boolean): void {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true, writable: true })
}
function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true, writable: true })
}

const realLocation = window.location
function stubLocationAssign(impl: (url: string) => void): void {
  // jsdom's location.assign is non-configurable, so replace the whole location object. The share
  // path only ever calls location.assign, so a minimal stand-in is enough.
  Object.defineProperty(window, 'location', {
    value: { assign: impl },
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  setSecureContext(true)
})

afterEach(() => {
  setShare(undefined)
  setClipboard(undefined)
  Object.defineProperty(window, 'location', {
    value: realLocation,
    configurable: true,
    writable: true,
  })
  vi.restoreAllMocks()
})

describe('ShareButton', () => {
  it('renders a full-width anchor whose href is waMeUrl(message) (AC1, AC3)', () => {
    render(<ShareButton message={MESSAGE} label="Share to WhatsApp" />)
    const link = screen.getByRole('link', { name: 'Share to WhatsApp' })
    expect(link).toHaveAttribute('href', waMeUrl(MESSAGE))
    expect(link).toHaveClass('w-full')
  })

  it('shares natively and prevents the navigation when a share sheet exists (AC2, AC4)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share)
    render(<ShareButton message={MESSAGE} label="Share to WhatsApp" />)

    // A document-level bubble listener runs after React's delegated handler, so it observes
    // whether the component called preventDefault. It also swallows any residual navigation.
    let prevented = false
    const observe = (e: Event): void => {
      prevented = e.defaultPrevented
      e.preventDefault()
    }
    document.addEventListener('click', observe)
    try {
      await userEvent.click(screen.getByRole('link', { name: 'Share to WhatsApp' }))
    } finally {
      document.removeEventListener('click', observe)
    }

    expect(share).toHaveBeenCalledWith({ text: MESSAGE })
    expect(prevented).toBe(true)
  })

  it('does not prevent the click when there is no native share (AC3)', async () => {
    setShare(undefined)
    render(<ShareButton message={MESSAGE} label="Share to WhatsApp" />)

    let prevented = true
    const observe = (e: Event): void => {
      prevented = e.defaultPrevented
      e.preventDefault() // stop jsdom's "navigation not implemented" noise after observing
    }
    document.addEventListener('click', observe)
    try {
      await userEvent.click(screen.getByRole('link', { name: 'Share to WhatsApp' }))
    } finally {
      document.removeEventListener('click', observe)
    }
    expect(prevented).toBe(false)
  })

  it('copies the exact message and shows a transient Copied (AC7)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    render(<ShareButton message={MESSAGE} label="Share to WhatsApp" />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy message' }))
    expect(writeText).toHaveBeenCalledWith(MESSAGE)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('falls back to a selectable readonly field when the clipboard is unavailable (AC7)', async () => {
    setClipboard(undefined)
    render(<ShareButton message={MESSAGE} label="Share to WhatsApp" />)

    await userEvent.click(screen.getByRole('button', { name: 'Copy message' }))
    const field = await screen.findByRole('textbox', { name: 'Share message' })
    expect(field).toHaveValue(MESSAGE)
    expect(field).toHaveAttribute('readonly')
  })

  it('shows the inline line and stays enabled when the share fails (AC6)', async () => {
    // Native present but rejecting non-Abort, and wa.me navigation throwing → failed.
    setShare(vi.fn().mockRejectedValue(new Error('nope')))
    stubLocationAssign(() => {
      throw new Error('blocked')
    })
    render(<ShareButton message={MESSAGE} label="Share to WhatsApp" />)

    const link = screen.getByRole('link', { name: 'Share to WhatsApp' })
    await userEvent.click(link)

    expect(
      await screen.findByText("Couldn't open WhatsApp. Copy the message instead."),
    ).toBeInTheDocument()
    expect(link).not.toHaveAttribute('aria-disabled')
  })
})
