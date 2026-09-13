import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '@/features/teams/schema'

const hoisted = vi.hoisted(() => ({
  gate: { value: { isPending: false, data: true } },
  admin: { value: { isPending: false, data: false } },
  teams: { value: { data: undefined as Team[] | undefined } },
}))

vi.mock('@/api/session', () => ({
  useIsTeamManager: () => hoisted.gate.value,
  useIsAdmin: () => hoisted.admin.value,
}))
vi.mock('@/api/teams', () => ({ useTeams: () => hoisted.teams.value }))
vi.mock('@/features/teams/join-link-panel', () => ({
  JoinLinkPanel: ({ role, teamActive }: { role: string; teamActive: boolean }) => (
    <div data-testid={`panel-${role}`}>{teamActive ? 'active' : 'inactive'}</div>
  ),
}))

const TeamMembersScreen = (await import('@/features/teams/team-members-screen')).default

const TEAM = '00000000-0000-4000-8000-000000000001'

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
  hoisted.gate.value = { isPending: false, data: true }
  hoisted.admin.value = { isPending: false, data: false }
  hoisted.teams.value = { data: [{ id: TEAM, name: 'Firsts', active: true, created_at: '' }] }
})

describe('gate (AC1)', () => {
  it('checks access without flashing before the gate resolves', () => {
    hoisted.gate.value = { isPending: true, data: false }
    renderScreen()
    expect(screen.getByRole('status', { name: /checking access/i })).toBeInTheDocument()
    expect(screen.queryByText('home screen')).not.toBeInTheDocument()
  })

  it('redirects a player home', () => {
    hoisted.gate.value = { isPending: false, data: false }
    renderScreen()
    expect(screen.getByText('home screen')).toBeInTheDocument()
  })

  it('a manager sees the squad panel but not the manager panel (AC8)', () => {
    renderScreen()
    expect(screen.getByTestId('panel-player')).toBeInTheDocument()
    expect(screen.queryByTestId('panel-manager')).not.toBeInTheDocument()
  })

  it('an admin sees both panels', () => {
    hoisted.admin.value = { isPending: false, data: true }
    renderScreen()
    expect(screen.getByTestId('panel-player')).toBeInTheDocument()
    expect(screen.getByTestId('panel-manager')).toBeInTheDocument()
  })

  it('passes the team active flag through from the teams cache (AC10)', () => {
    hoisted.teams.value = { data: [{ id: TEAM, name: 'Firsts', active: false, created_at: '' }] }
    renderScreen()
    expect(screen.getByTestId('panel-player')).toHaveTextContent('inactive')
  })
})
