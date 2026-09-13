import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TeamInviteView } from '@/features/teams/schema'
import { joinUrl } from '@/lib/paths'

interface InviteState {
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  data: TeamInviteView | null | undefined
  refetch: () => void
}

const hoisted = vi.hoisted(() => ({
  invite: { value: null as unknown as InviteState },
  create: { fn: vi.fn(), isPending: false },
  revoke: { fn: vi.fn(), isPending: false },
}))

vi.mock('@/api/invites', () => ({
  useTeamInvite: () => hoisted.invite.value,
  useCreateTeamInvite: () => ({ mutate: hoisted.create.fn, isPending: hoisted.create.isPending }),
  useRevokeTeamInvite: () => ({ mutate: hoisted.revoke.fn, isPending: hoisted.revoke.isPending }),
}))

const { JoinLinkPanel } = await import('@/features/teams/join-link-panel')

const TEAM = '00000000-0000-4000-8000-000000000001'
const TOKEN = 'A'.repeat(43)

const populated = (over: Partial<TeamInviteView> = {}): InviteState => ({
  isPending: false,
  isError: false,
  isSuccess: true,
  data: {
    token: TOKEN,
    role: 'player',
    expires_at: '2026-07-05T18:00:00+00:00',
    created_at: '2026-04-06T18:00:00+00:00',
    ...over,
  },
  refetch: vi.fn(),
})

const empty = (): InviteState => ({
  isPending: false,
  isError: false,
  isSuccess: true,
  data: null,
  refetch: vi.fn(),
})

function renderPanel(props: Partial<Parameters<typeof JoinLinkPanel>[0]> = {}) {
  return render(
    <MemoryRouter>
      <JoinLinkPanel teamId={TEAM} role="player" teamActive isAdmin={false} {...props} />
    </MemoryRouter>,
  )
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  hoisted.create.fn.mockReset()
  hoisted.create.isPending = false
  hoisted.revoke.fn.mockReset()
  hoisted.revoke.isPending = false
})

describe('four states (AC13)', () => {
  it('loading: a skeleton, no controls', () => {
    hoisted.invite.value = {
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined,
      refetch: vi.fn(),
    }
    renderPanel()
    expect(screen.queryByRole('button', { name: /create|copy|revoke/i })).not.toBeInTheDocument()
  })

  it('error: one line and a Try again that refetches', async () => {
    const refetch = vi.fn()
    hoisted.invite.value = {
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
      refetch,
    }
    renderPanel()
    expect(screen.getByText("Couldn't load the join link.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('empty: "No join link yet." and a single Create button (AC2)', async () => {
    hoisted.invite.value = empty()
    renderPanel()
    expect(screen.getByText('No join link yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Create join link' }))
    expect(hoisted.create.fn).toHaveBeenCalledWith('player', expect.anything())
  })

  it('populated: the exact join URL, the who-can-join line, and the expiry through formatEventTime (AC3, AC5)', () => {
    hoisted.invite.value = populated()
    renderPanel()
    expect(screen.getByText(joinUrl(TOKEN))).toBeInTheDocument()
    expect(screen.getByText('Anyone with this link can join as a player.')).toBeInTheDocument()
    expect(screen.getByText('Expires Sun 5 Jul, 7pm.')).toBeInTheDocument()
  })
})

describe('regenerate (AC6)', () => {
  beforeEach(() => {
    hoisted.invite.value = populated()
  })

  it('fires no mutation until the dialog is confirmed', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/stops working immediately/i)).toBeInTheDocument()
    expect(hoisted.create.fn).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
    expect(hoisted.create.fn).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }))
    const reopened = await screen.findByRole('alertdialog')
    await userEvent.click(within(reopened).getByRole('button', { name: 'Regenerate' }))
    expect(hoisted.create.fn).toHaveBeenCalledWith('player', expect.anything())
  })
})

describe('revoke (AC7)', () => {
  it('confirms before revoking', async () => {
    hoisted.invite.value = populated()
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(hoisted.revoke.fn).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }))
    expect(hoisted.revoke.fn).toHaveBeenCalledWith('player', expect.anything())
  })
})

describe('manager link gate (AC8, AC9)', () => {
  it('the manager variant states single use and its 24-hour expiry, with no Regenerate', () => {
    hoisted.invite.value = populated({ role: 'manager' })
    renderPanel({ role: 'manager', isAdmin: true })
    expect(screen.getByText('Single use. Expires Sun 5 Jul, 7pm.')).toBeInTheDocument()
    expect(screen.getByText('Send it to one person, not the squad group.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Regenerate' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument()
  })
})

describe('inactive team (AC10)', () => {
  it('empty state: Create disabled with the reactivate line', () => {
    hoisted.invite.value = empty()
    renderPanel({ teamActive: false })
    expect(screen.getByRole('button', { name: 'Create join link' })).toBeDisabled()
    expect(screen.getByText(/Reactivate this team to issue join links/)).toBeInTheDocument()
  })

  it('populated state: Regenerate disabled, Revoke still live', () => {
    hoisted.invite.value = populated()
    renderPanel({ teamActive: false })
    expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeEnabled()
  })
})
