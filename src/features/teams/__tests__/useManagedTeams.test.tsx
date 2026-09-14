import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser, CurrentUserState } from '@/features/auth/use-current-user'
import type { Team } from '@/features/teams/schema'

interface TeamsQueryLike {
  isPending: boolean
  isError: boolean
  data: Team[] | undefined
}

const hoisted = vi.hoisted(() => ({
  account: { value: null as unknown as CurrentUserState },
  teams: { value: null as unknown as TeamsQueryLike },
}))

vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => hoisted.account.value,
}))
vi.mock('@/api/teams', () => ({
  useTeams: () => hoisted.teams.value,
}))

const { useManagedTeams } = await import('@/features/teams/hooks/useManagedTeams')

const team = (id: string, name: string, active = true): Team => ({
  id,
  name,
  active,
  created_at: '2026-01-01T00:00:00Z',
})

const ready = (over: Partial<CurrentUser>): CurrentUserState => ({
  status: 'ready',
  user: {
    id: 'u1',
    name: 'U',
    phone: '+353870000000',
    isAdmin: false,
    memberships: [],
    managedTeams: [],
    isManagerOfAny: false,
    roleForTeam: () => null,
    isManagerOf: () => false,
    ...over,
  },
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useManagedTeams (S6.3)', () => {
  it('reports loading while either the account or the teams query is pending', () => {
    hoisted.account.value = { status: 'loading' }
    hoisted.teams.value = { isPending: true, isError: false, data: undefined }
    const { result } = renderHook(() => useManagedTeams())
    expect(result.current).toEqual({ teams: [], isLoading: true, isError: false })
  })

  it('reports error when the teams query errors', () => {
    hoisted.account.value = ready({ isAdmin: true })
    hoisted.teams.value = { isPending: false, isError: true, data: undefined }
    const { result } = renderHook(() => useManagedTeams())
    expect(result.current.isError).toBe(true)
    expect(result.current.teams).toEqual([])
  })

  it('includes every team for an admin, membership or not', () => {
    hoisted.account.value = ready({ isAdmin: true, roleForTeam: () => null })
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      data: [team('a', 'Firsts'), team('b', 'Seconds')],
    }
    const { result } = renderHook(() => useManagedTeams())
    expect(result.current.teams.map((t) => t.id)).toEqual(['a', 'b'])
  })

  it('excludes a team where the caller is a player, keeps the one they manage', () => {
    const roles: Record<string, 'player' | 'manager'> = { a: 'manager', b: 'player' }
    hoisted.account.value = ready({
      isAdmin: false,
      roleForTeam: (id: string) => roles[id] ?? null,
    })
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      data: [team('a', 'Firsts'), team('b', 'Seconds')],
    }
    const { result } = renderHook(() => useManagedTeams())
    expect(result.current.teams.map((t) => t.id)).toEqual(['a'])
  })

  it('orders active teams before inactive, then case-insensitively by name', () => {
    hoisted.account.value = ready({ isAdmin: true })
    hoisted.teams.value = {
      isPending: false,
      isError: false,
      data: [
        team('1', 'bravo'),
        team('2', 'Alpha'),
        team('3', 'Zeta', false),
        team('4', 'alpha', false),
      ],
    }
    const { result } = renderHook(() => useManagedTeams())
    // active (Alpha, bravo) case-insensitively, then inactive (alpha, Zeta).
    expect(result.current.teams.map((t) => t.name)).toEqual(['Alpha', 'bravo', 'alpha', 'Zeta'])
  })
})
