import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import type { MemberDirectoryRow, MemberRole } from '@/features/teams/schema'
import { resetUrl } from '@/lib/paths'

const hoisted = vi.hoisted(() => ({
  issue: {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null as { kind: string } | null,
    reset: vi.fn(),
  },
  user: {
    isAdmin: false,
    role: null as MemberRole | null,
  },
}))

vi.mock('@/api/reset', () => ({
  useIssueResetToken: () => hoisted.issue,
}))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => ({
    status: 'ready',
    user: {
      isAdmin: hoisted.user.isAdmin,
      roleForTeam: () => hoisted.user.role,
    },
  }),
}))

const { IssueResetLinkAction } = await import('@/features/teams/IssueResetLinkAction')

const TEAM = '00000000-0000-4000-8000-000000000001'
const member = (over: Partial<MemberDirectoryRow> = {}): MemberDirectoryRow => ({
  user_id: '00000000-0000-4000-8000-0000000000aa',
  name: 'Aaron Byrne',
  role: 'player',
  joined_at: '2026-01-10T00:00:00Z',
  phone: '+353871234567',
  ...over,
})

// The action lives inside a member card's dropdown; mount it inside an open menu like the card does.
function renderAction(m: MemberDirectoryRow = member()) {
  return render(
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger asChild>
        <Button>Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <IssueResetLinkAction teamId={TEAM} member={m} />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  hoisted.issue.mutate.mockReset()
  hoisted.issue.reset.mockReset()
  hoisted.issue.isPending = false
  hoisted.issue.isError = false
  hoisted.issue.error = null
  hoisted.user.isAdmin = false
  hoisted.user.role = 'manager'
})

describe('IssueResetLinkAction visibility (AC1, AC3)', () => {
  it('a manager sees Reset password on a player', () => {
    renderAction(member({ role: 'player' }))
    expect(screen.getByRole('menuitem', { name: 'Reset password' })).toBeInTheDocument()
  })

  it('a manager does not see it on a co-manager', () => {
    renderAction(member({ role: 'manager' }))
    expect(screen.queryByRole('menuitem', { name: 'Reset password' })).not.toBeInTheDocument()
  })

  it('an admin sees it on a manager', () => {
    hoisted.user.isAdmin = true
    hoisted.user.role = null
    renderAction(member({ role: 'manager' }))
    expect(screen.getByRole('menuitem', { name: 'Reset password' })).toBeInTheDocument()
  })
})

describe('IssueResetLinkAction issuing (AC4, AC5)', () => {
  it('shows the full reset link in the dialog on success', async () => {
    hoisted.issue.mutate.mockImplementation(
      (_vars: unknown, opts: { onSuccess: (r: { token: string }) => void }) => {
        opts.onSuccess({ token: 'the-fresh-token' })
      },
    )
    const user = userEvent.setup()
    renderAction()
    await user.click(screen.getByRole('menuitem', { name: 'Reset password' }))

    expect(
      await screen.findByRole('heading', { name: "Reset Aaron's password" }),
    ).toBeInTheDocument()
    expect(screen.getByText(resetUrl('the-fresh-token'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    expect(
      screen.getByText(/One use\. Expires in 24 hours\. Send it to Aaron Byrne on WhatsApp\./),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/This link is only shown once\. Close this and you'll need a new one\./),
    ).toBeInTheDocument()
  })

  it('renders not_authorised as plain copy, not a Postgres message', () => {
    hoisted.issue.isError = true
    hoisted.issue.error = { kind: 'not_authorised' }
    renderAction()
    expect(screen.getByText("You can't reset that person.")).toBeInTheDocument()
  })

  it('renders any other failure as the generic retry line', () => {
    hoisted.issue.isError = true
    hoisted.issue.error = { kind: 'unknown' }
    renderAction()
    expect(screen.getByText("Couldn't create a link. Try again.")).toBeInTheDocument()
  })
})
