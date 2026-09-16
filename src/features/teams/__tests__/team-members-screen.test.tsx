import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { TEAM_COLOUR_DEFAULT } from '@/features/teams/palette'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUserState } from '@/features/auth/use-current-user'
import type { Team } from '@/features/teams/schema'

const TEAM = '00000000-0000-4000-8000-000000000001'

/** A ready account: manager of TEAM iff `manages`, admin iff `admin`. The screen reads
 *  `.status`, `.user.isManagerOf(teamId)` and `.user.isAdmin`. */
const ready = (manages: boolean, admin: boolean): CurrentUserState => ({
  status: 'ready',
  user: {
    id: 'u1',
    name: 'Someone',
    phone: '+353870000000',
    isAdmin: admin,
    avatarPath: null,
    memberships: [],
    managedTeams: [],
    administrableTeams: [],
    isManagerOfAny: manages,
    roleForTeam: () => (manages ? 'manager' : null),
    isManagerOf: (id: string) => (id === TEAM && manages) || admin,
  },
})

const hoisted = vi.hoisted(() => ({
  account: { value: null as unknown as CurrentUserState },
  teams: { value: { data: undefined as Team[] | undefined } },
}))

vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => hoisted.account.value,
}))
vi.mock('@/api/teams', () => ({ useTeams: () => hoisted.teams.value }))
vi.mock('@/features/teams/join-link-panel', () => ({
  JoinLinkPanel: ({ role, teamActive }: { role: string; teamActive: boolean }) => (
    <div data-testid={`panel-${role}`}>{teamActive ? 'active' : 'inactive'}</div>
  ),
}))
vi.mock('@/features/teams/member-list', () => ({
  MemberList: ({ teamId }: { teamId: string }) => <div data-testid="member-list">{teamId}</div>,
}))

const TeamMembersScreen = (await import('@/features/teams/team-members-screen')).default

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/manage/team/${TEAM}/members`]}>
      <Routes>
        <Route path="/manage/team/:teamId/members" element={<TeamMembersScreen />} />
        <Route path="/" element={<div>home screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hoisted.account.value = ready(true, false)
  hoisted.teams.value = {
    data: [{ id: TEAM, name: 'Firsts', active: true, colour: TEAM_COLOUR_DEFAULT, created_at: '' }],
  }
})

describe('gate (AC1)', () => {
  it('checks access without flashing before the gate resolves', () => {
    hoisted.account.value = { status: 'loading' }
    renderScreen()
    expect(screen.getByRole('status', { name: /checking access/i })).toBeInTheDocument()
    expect(screen.queryByText('home screen')).not.toBeInTheDocument()
  })

  it('redirects a player home', () => {
    hoisted.account.value = ready(false, false)
    renderScreen()
    expect(screen.getByText('home screen')).toBeInTheDocument()
  })

  it('a manager sees the squad panel but not the manager panel (AC8)', () => {
    renderScreen()
    expect(screen.getByTestId('panel-player')).toBeInTheDocument()
    expect(screen.queryByTestId('panel-manager')).not.toBeInTheDocument()
  })

  it('an admin sees both panels', () => {
    hoisted.account.value = ready(false, true)
    renderScreen()
    expect(screen.getByTestId('panel-player')).toBeInTheDocument()
    expect(screen.getByTestId('panel-manager')).toBeInTheDocument()
  })

  it('passes the team active flag through from the teams cache (AC10)', () => {
    hoisted.teams.value = {
      data: [
        { id: TEAM, name: 'Firsts', active: false, colour: TEAM_COLOUR_DEFAULT, created_at: '' },
      ],
    }
    renderScreen()
    expect(screen.getByTestId('panel-player')).toHaveTextContent('inactive')
  })
})
