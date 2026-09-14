import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '@/features/auth/use-current-user'
import type { Team } from '@/features/teams/schema'
import { TEAM_COLOUR_DEFAULT } from '@/features/teams/palette'

/**
 * S11.1: the month/upcoming reads filter by the caller's memberships for a player (unchanged) and
 * by every active team for an admin. This test spies on the `.in('team_id', …)` the query builds
 * and on whether the query fires at all — the client-side scoping, not RLS (which S1.4 proves).
 */

const TEAM_A = '00000000-0000-4000-8000-000000000001'
const TEAM_B = '00000000-0000-4000-8000-000000000002'
const USER = '00000000-0000-4000-8000-0000000000aa'

const captured: { in?: { col: string; vals: unknown } } = {}

function builder() {
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.in = (col: string, vals: unknown) => {
    captured.in = { col, vals }
    return b
  }
  b.gte = () => b
  b.lt = () => b
  b.eq = () => b
  b.order = () => b
  b.limit = () => Promise.resolve({ data: [], error: null })
  return b
}

vi.mock('@/lib/supabase', () => ({ supabase: { from: () => builder() } }))

const hoisted = vi.hoisted(() => ({ user: { value: null as unknown as CurrentUser } }))
vi.mock('@/features/auth/use-current-user', () => ({
  useSignedInUser: () => hoisted.user.value,
}))

const { useUpcomingEvents, useMonthEvents } = await import('@/api/events')

const team = (id: string): Team => ({
  id,
  name: id,
  active: true,
  colour: TEAM_COLOUR_DEFAULT,
  created_at: '2026-01-01T00:00:00Z',
})

function user(over: Partial<CurrentUser>): CurrentUser {
  return {
    id: USER,
    name: 'U',
    phone: '+353870000000',
    isAdmin: false,
    memberships: [],
    managedTeams: [],
    administrableTeams: [],
    isManagerOfAny: false,
    roleForTeam: () => null,
    isManagerOf: () => false,
    ...over,
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const membership = (teamId: string) =>
  ({ teamId, teamName: teamId, role: 'player', joinedAt: '2026-01-01T00:00:00Z' }) as const

beforeEach(() => {
  captured.in = undefined
})

describe('useUpcomingEvents / useMonthEvents scoping (S11.1)', () => {
  it('a player is filtered to their own memberships', async () => {
    hoisted.user.value = user({ memberships: [membership(TEAM_A)] })
    renderHook(() => useUpcomingEvents(), { wrapper })
    await waitFor(() => {
      expect(captured.in).toEqual({ col: 'team_id', vals: [TEAM_A] })
    })
  })

  it('a membership-less admin is filtered to every active team', async () => {
    hoisted.user.value = user({
      isAdmin: true,
      memberships: [],
      administrableTeams: [team(TEAM_A), team(TEAM_B)],
    })
    renderHook(() => useMonthEvents('2026-09'), { wrapper })
    await waitFor(() => {
      expect(captured.in).toEqual({ col: 'team_id', vals: [TEAM_A, TEAM_B] })
    })
  })

  it('a player with no memberships fires no request (enabled gate unchanged)', () => {
    hoisted.user.value = user({ memberships: [] })
    const { result } = renderHook(() => useUpcomingEvents(), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(captured.in).toBeUndefined()
  })
})
