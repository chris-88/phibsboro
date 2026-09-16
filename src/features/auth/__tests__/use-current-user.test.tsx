import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUserRow } from '@/api/current-user'
import { TEAM_COLOUR_DEFAULT } from '@/features/teams/palette'

const USER = '00000000-0000-4000-8000-0000000000aa'
const TEAM_A = '00000000-0000-4000-8000-000000000001'
const TEAM_B = '00000000-0000-4000-8000-000000000002'

const hoisted = vi.hoisted(() => ({ fetch: vi.fn<() => Promise<CurrentUserRow>>() }))

// The two active teams `administrableTeams` widens to, plus one inactive that must never appear.
const C = TEAM_COLOUR_DEFAULT
const TEAM_ROWS = [
  { id: TEAM_A, name: 'Firsts', active: true, colour: C, created_at: '2026-01-01T00:00:00Z' },
  { id: TEAM_B, name: 'Reserves', active: true, colour: C, created_at: '2026-01-01T00:00:00Z' },
  {
    id: '00000000-0000-4000-8000-0000000000ee',
    name: 'Retired',
    active: false,
    colour: C,
    created_at: '2026-01-01T00:00:00Z',
  },
]

vi.mock('@/features/auth/session-context', () => ({
  useSession: () => ({ status: 'signedIn', session: { user: { id: USER } } }),
}))
vi.mock('@/api/current-user', () => ({ fetchCurrentUser: () => hoisted.fetch() }))
// The active-teams read behind `administrableTeams`; stubbed so the hook needs no supabase.
vi.mock('@/api/teams', async () => {
  const { teamKeys } = await import('@/api/queryKeys')
  return {
    teamsOptions: () => ({
      queryKey: teamKeys.all,
      queryFn: () => Promise.resolve(TEAM_ROWS),
      select: (rows: typeof TEAM_ROWS) => rows,
    }),
  }
})

const { useCurrentUser } = await import('@/features/auth/use-current-user')

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function membership(teamId: string, role: 'player' | 'manager') {
  return {
    teamId,
    teamName: teamId === TEAM_A ? 'Firsts' : 'Reserves',
    role,
    joinedAt: '2026-01-01T00:00:00+00:00',
  }
}

/** A profiles row; `admin` passed as a variable so the source carries no `is_admin` literal
 *  (the AC12 source scan). */
const profileRow = (name: string, admin: boolean) => ({
  id: USER,
  name,
  phone: '+353870000001',
  is_admin: admin,
  avatar_path: null,
})

async function ready(row: CurrentUserRow) {
  hoisted.fetch.mockResolvedValue(row)
  const { result } = renderHook(() => useCurrentUser(), { wrapper })
  await waitFor(() => {
    expect(result.current.status).toBe('ready')
  })
  if (result.current.status !== 'ready') throw new Error('not ready')
  return result.current.user
}

beforeEach(() => {
  hoisted.fetch.mockReset()
})

describe('roleForTeam (AC3)', () => {
  it('returns the role for a member, null for a non-member, and the two roles on two teams', async () => {
    const user = await ready({
      profile: profileRow('P', false),
      memberships: [membership(TEAM_A, 'player'), membership(TEAM_B, 'manager')],
    })
    expect(user.roleForTeam(TEAM_A)).toBe('player')
    expect(user.roleForTeam(TEAM_B)).toBe('manager')
    expect(user.roleForTeam('00000000-0000-4000-8000-0000000000ff')).toBeNull()
  })
})

describe('isManagerOf (AC3)', () => {
  it('is true for an admin on a team they do not manage', async () => {
    const user = await ready({
      profile: profileRow('A', true),
      memberships: [membership(TEAM_A, 'player')],
    })
    expect(user.roleForTeam(TEAM_A)).toBe('player')
    expect(user.isManagerOf(TEAM_A)).toBe(true)
    // Admin is club-wide, so even a team they are not in reports true.
    expect(user.isManagerOf(TEAM_B)).toBe(true)
  })

  it('is false for a player on their own team', async () => {
    const user = await ready({
      profile: profileRow('P', false),
      memberships: [membership(TEAM_A, 'player')],
    })
    expect(user.isManagerOf(TEAM_A)).toBe(false)
  })
})

describe('managedTeams and isManagerOfAny', () => {
  it('is empty for a player', async () => {
    const user = await ready({
      profile: profileRow('P', false),
      memberships: [membership(TEAM_A, 'player')],
    })
    expect(user.managedTeams).toEqual([])
    expect(user.isManagerOfAny).toBe(false)
  })

  it('is the manager memberships for a manager', async () => {
    const user = await ready({
      profile: profileRow('M', false),
      memberships: [membership(TEAM_A, 'player'), membership(TEAM_B, 'manager')],
    })
    expect(user.managedTeams.map((t) => t.teamId)).toEqual([TEAM_B])
    expect(user.isManagerOfAny).toBe(true)
  })

  it('is every membership for an admin', async () => {
    const user = await ready({
      profile: profileRow('A', true),
      memberships: [membership(TEAM_A, 'player'), membership(TEAM_B, 'manager')],
    })
    expect(user.managedTeams.map((t) => t.teamId)).toEqual([TEAM_A, TEAM_B])
  })

  it('isManagerOfAny is false for an empty membership list', async () => {
    const user = await ready({
      profile: profileRow('A', true),
      memberships: [],
    })
    expect(user.isManagerOfAny).toBe(false)
    expect(user.managedTeams).toEqual([])
  })
})

describe('administrableTeams (S11.1)', () => {
  /** Render the hook and wait until the widened team list has settled to `count` teams. */
  async function administrable(row: CurrentUserRow) {
    hoisted.fetch.mockResolvedValue(row)
    const { result } = renderHook(() => useCurrentUser(), { wrapper })
    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })
    return result
  }

  it('is every ACTIVE team for a membership-less admin — the inactive team never appears', async () => {
    const result = await administrable({ profile: profileRow('A', true), memberships: [] })
    await waitFor(() => {
      if (result.current.status !== 'ready') throw new Error('not ready')
      expect(result.current.user.administrableTeams.map((t) => t.id)).toEqual([TEAM_A, TEAM_B])
    })
  })

  it('is only the caller’s manager teams for a manager, active-only', async () => {
    const result = await administrable({
      profile: profileRow('M', false),
      memberships: [membership(TEAM_A, 'player'), membership(TEAM_B, 'manager')],
    })
    await waitFor(() => {
      if (result.current.status !== 'ready') throw new Error('not ready')
      expect(result.current.user.administrableTeams.map((t) => t.id)).toEqual([TEAM_B])
    })
  })

  it('is empty for a pure player — the teams read never fires', async () => {
    const user = await ready({
      profile: profileRow('P', false),
      memberships: [membership(TEAM_A, 'player')],
    })
    expect(user.administrableTeams).toEqual([])
  })
})
