import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Team } from '@/features/teams/schema'

interface ManagedTeamsLike {
  teams: Team[]
  isLoading: boolean
  isError: boolean
}

const hoisted = vi.hoisted(() => ({
  managed: { value: null as unknown as ManagedTeamsLike },
}))

vi.mock('@/features/teams/hooks/useManagedTeams', () => ({
  useManagedTeams: () => hoisted.managed.value,
}))

const { useActiveTeam } = await import('@/features/teams/hooks/useActiveTeam')
const { useManageStore } = await import('@/features/teams/manageStore')

const team = (id: string, name: string, active = true): Team => ({
  id,
  name,
  active,
  created_at: '2026-01-01T00:00:00Z',
})

beforeEach(() => {
  useManageStore.setState({ selectedTeamId: null })
  try {
    localStorage.clear()
  } catch {
    /* jsdom always has it */
  }
})
afterEach(() => {
  vi.clearAllMocks()
})

describe('useActiveTeam (S6.3)', () => {
  it('keeps a stored id that is still a managed team, and writes nothing', () => {
    useManageStore.setState({ selectedTeamId: 'b' })
    hoisted.managed.value = {
      teams: [team('a', 'Firsts'), team('b', 'Seconds')],
      isLoading: false,
      isError: false,
    }
    const { result } = renderHook(() => useActiveTeam())
    expect(result.current.teamId).toBe('b')
    expect(result.current.team?.name).toBe('Seconds')
    expect(result.current.canManageMany).toBe(true)
    expect(useManageStore.getState().selectedTeamId).toBe('b')
  })

  it('falls back to the first managed team for a stale stored id and writes it back once', async () => {
    useManageStore.setState({ selectedTeamId: 'gone' })
    hoisted.managed.value = {
      teams: [team('a', 'Firsts'), team('b', 'Seconds')],
      isLoading: false,
      isError: false,
    }
    const { result } = renderHook(() => useActiveTeam())
    expect(result.current.teamId).toBe('a')
    await waitFor(() => {
      expect(useManageStore.getState().selectedTeamId).toBe('a')
    })
  })

  it('resolves to null and writes nothing when there are no managed teams', () => {
    hoisted.managed.value = { teams: [], isLoading: false, isError: false }
    const { result } = renderHook(() => useActiveTeam())
    expect(result.current.teamId).toBeNull()
    expect(result.current.team).toBeNull()
    expect(result.current.canManageMany).toBe(false)
    expect(useManageStore.getState().selectedTeamId).toBeNull()
  })

  it('passes loading and error through from useManagedTeams', () => {
    hoisted.managed.value = { teams: [], isLoading: true, isError: false }
    const { result, rerender } = renderHook(() => useActiveTeam())
    expect(result.current.isLoading).toBe(true)

    hoisted.managed.value = { teams: [], isLoading: false, isError: true }
    rerender()
    expect(result.current.isError).toBe(true)
  })
})
