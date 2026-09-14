import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberDirectoryRow } from '@/features/teams/schema'

interface MembersState {
  isPending: boolean
  isError: boolean
  data: MemberDirectoryRow[] | undefined
  refetch: () => void
}

const hoisted = vi.hoisted(() => ({ members: { value: null as unknown as MembersState } }))

vi.mock('@/api/members', () => ({ useTeamMembers: () => hoisted.members.value }))
vi.mock('@/features/teams/member-card', () => ({
  MemberCard: ({ member, managerCount }: { member: MemberDirectoryRow; managerCount: number }) => (
    <div data-testid="member-card">
      {member.name} ({member.role}) mgrs={managerCount}
    </div>
  ),
}))

const { MemberList } = await import('@/features/teams/member-list')

const TEAM = '00000000-0000-4000-8000-000000000001'

function renderList() {
  return render(<MemberList teamId={TEAM} teamName="Firsts" isAdmin />)
}

const person = (over: Partial<MemberDirectoryRow>): MemberDirectoryRow => ({
  user_id: crypto.randomUUID(),
  name: 'Someone',
  role: 'player',
  joined_at: '2026-01-01T00:00:00Z',
  phone: null,
  ...over,
})

beforeEach(() => {
  hoisted.members.value = { isPending: false, isError: false, data: [], refetch: vi.fn() }
})

describe('MemberList states (AC14)', () => {
  it('shows skeletons while loading', () => {
    hoisted.members.value = { isPending: true, isError: false, data: undefined, refetch: vi.fn() }
    const { container } = renderList()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('member-card')).not.toBeInTheDocument()
  })

  it('shows an inline retry on error', () => {
    hoisted.members.value = { isPending: false, isError: true, data: undefined, refetch: vi.fn() }
    renderList()
    expect(screen.getByText("Couldn't load the squad.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows the empty line when no one has joined', () => {
    renderList()
    expect(screen.getByText('No one has joined this team yet.')).toBeInTheDocument()
  })

  it('renders one card per member and passes the manager count down', () => {
    hoisted.members.value = {
      isPending: false,
      isError: false,
      data: [
        person({ name: 'Declan', role: 'manager' }),
        person({ name: 'Aaron', role: 'player' }),
      ],
      refetch: vi.fn(),
    }
    renderList()
    const cards = screen.getAllByTestId('member-card')
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveTextContent('mgrs=1')
  })
})
