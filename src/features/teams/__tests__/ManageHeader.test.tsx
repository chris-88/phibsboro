import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUserState } from '@/features/auth/use-current-user'
import type { ActiveTeam } from '@/features/teams/hooks/useActiveTeam'
import type { ManagedTeams } from '@/features/teams/hooks/useManagedTeams'
import type { Team } from '@/features/teams/schema'

const hoisted = vi.hoisted(() => ({
  account: { value: null as unknown as CurrentUserState },
  managed: { value: null as unknown as ManagedTeams },
  active: { value: null as unknown as ActiveTeam },
}))

vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => hoisted.account.value,
}))
vi.mock('@/features/teams/hooks/useManagedTeams', () => ({
  useManagedTeams: () => hoisted.managed.value,
}))
vi.mock('@/features/teams/hooks/useActiveTeam', () => ({
  useActiveTeam: () => hoisted.active.value,
}))

const { ManageHeader } = await import('@/features/teams/components/ManageHeader')

const team = (id: string, name: string, active = true): Team => ({
  id,
  name,
  active,
  created_at: '2026-01-01T00:00:00Z',
})

const readyAdmin = (isAdmin: boolean): CurrentUserState =>
  ({ status: 'ready', user: { isAdmin } }) as CurrentUserState

const set = (teams: Team[], teamId: string, account: CurrentUserState): void => {
  hoisted.account.value = account
  hoisted.managed.value = { teams, isLoading: false, isError: false }
  hoisted.active.value = {
    teamId,
    team: teams.find((t) => t.id === teamId) ?? null,
    canManageMany: teams.length > 1,
    isLoading: false,
    isError: false,
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ManageHeader (S6.3)', () => {
  it('shows plain text, not a picker, for a manager of exactly one team (AC2)', () => {
    set([team('a', 'Firsts')], 'a', readyAdmin(false))
    render(<ManageHeader />)
    expect(screen.getByText('Firsts')).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows a picker for an admin even with a single team (AC3)', () => {
    set([team('a', 'Firsts')], 'a', readyAdmin(true))
    render(<ManageHeader />)
    expect(screen.getByRole('combobox', { name: 'Team' })).toBeInTheDocument()
  })

  it('shows a picker for a manager of more than one team (AC2)', () => {
    set([team('a', 'Firsts'), team('b', 'Seconds')], 'a', readyAdmin(false))
    render(<ManageHeader />)
    expect(screen.getByRole('combobox', { name: 'Team' })).toBeInTheDocument()
  })

  it('badges the trigger Inactive when the active team is inactive (AC5)', () => {
    set([team('a', 'Firsts', false), team('b', 'Seconds')], 'a', readyAdmin(true))
    render(<ManageHeader />)
    const trigger = screen.getByRole('combobox', { name: 'Team' })
    expect(trigger).toHaveTextContent('Firsts')
    expect(trigger).toHaveTextContent('Inactive')
  })
})
