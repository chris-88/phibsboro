import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyLinkField } from '@/features/teams/copy-link-field'
import { teamInviteViewSchema } from '@/features/teams/schema'

const URL = 'https://example.test/x/join/abc'

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true, writable: true })
}

afterEach(() => {
  setClipboard(undefined)
  vi.restoreAllMocks()
})

describe('CopyLinkField (AC4)', () => {
  it('writes the exact URL and shows a transient Copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    render(<CopyLinkField url={URL} label="Join link URL" />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).toHaveBeenCalledWith(URL)
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('falls back to a selectable readonly field when the clipboard is unavailable, throwing nothing', async () => {
    setClipboard(undefined)
    render(<CopyLinkField url={URL} label="Join link URL" />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    const field = await screen.findByRole('textbox', { name: 'Join link URL' })
    expect(field).toHaveValue(URL)
    expect(field).toHaveAttribute('readonly')
    expect(screen.getByText('Copy this link')).toBeInTheDocument()
  })

  it('falls back when the clipboard write rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    render(<CopyLinkField url={URL} label="Join link URL" />)
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByRole('textbox', { name: 'Join link URL' })).toHaveValue(URL)
  })
})

describe('teamInviteViewSchema', () => {
  const row = {
    token: 'abc',
    expires_at: '2026-07-05T18:00:00+00:00',
    created_at: '2026-04-06T18:00:00+00:00',
  }

  it('accepts a player row and a null expiry', () => {
    expect(teamInviteViewSchema.parse({ ...row, role: 'player' }).role).toBe('player')
    expect(
      teamInviteViewSchema.parse({ ...row, role: 'manager', expires_at: null }).expires_at,
    ).toBeNull()
  })

  it('rejects a role of admin', () => {
    expect(teamInviteViewSchema.safeParse({ ...row, role: 'admin' }).success).toBe(false)
  })
})
