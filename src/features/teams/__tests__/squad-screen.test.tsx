import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { TEAM_COLOUR_DEFAULT } from '@/features/teams/palette'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventRow } from '@/features/events/schema'
import type { ActiveTeam } from '@/features/teams/hooks/useActiveTeam'

const TEAM = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-09-14T12:00:00Z'

vi.mock('@/lib/serverClock', () => ({ serverNow: () => new Date(NOW) }))

const hoisted = vi.hoisted(() => ({
  active: { value: null as unknown as ActiveTeam },
  events: {
    value: {
      isPending: false,
      isError: false,
      data: [] as EventRow[],
      refetch: () => undefined,
    },
  },
}))

vi.mock('@/features/teams/hooks/useActiveTeam', () => ({
  useActiveTeam: () => hoisted.active.value,
}))
vi.mock('@/api/events', () => ({ useTeamEvents: () => hoisted.events.value }))
// The matchday row reads the per-match squad for its status hint (S9.2); a stub keeps this suite
// about the list, not the squad read. Undefined data renders the "Squad not picked" hint.
vi.mock('@/api/squad', () => ({ useEventSquad: () => ({ data: undefined }) }))
// Convenience-role flag only; not under test here.
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => ({ status: 'ready', user: { isAdmin: false } }),
}))
// The header is exercised by its own suite; a light stub keeps this about the two sections.
vi.mock('@/features/teams/components/ManageHeader', () => ({
  ManageHeader: () => <div data-testid="manage-header" />,
}))
// The S6.4 roster is embedded, not re-tested here.
vi.mock('@/features/teams/member-list', () => ({
  MemberList: ({ teamId }: { teamId: string }) => <div data-testid="member-list">{teamId}</div>,
}))

const SquadScreen = (await import('@/features/teams/squad-screen')).default

/** A minimal EventRow — the screen reads id, type, status, title, location, starts_at, meet_at. */
function event(over: Partial<EventRow> & Pick<EventRow, 'id'>): EventRow {
  return {
    team_id: TEAM,
    type: 'match',
    title: 'Match',
    location: 'Bogies',
    notes: null,
    opponent: 'Kilbarrack',
    home_away: 'home',
    meet_at: null,
    starts_at: '2026-09-20T14:00:00Z',
    status: 'scheduled',
    series_id: null,
    created_by: null,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  }
}

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/squad']}>
        <Routes>
          <Route path="/squad" element={<SquadScreen />} />
          <Route path="/" element={<div>home screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const activeTeam = (over: Partial<ActiveTeam> = {}): ActiveTeam => ({
  teamId: TEAM,
  team: { id: TEAM, name: 'Firsts', active: true, colour: TEAM_COLOUR_DEFAULT, created_at: '' },
  canManageMany: false,
  isLoading: false,
  isError: false,
  ...over,
})

beforeEach(() => {
  hoisted.active.value = activeTeam()
  hoisted.events.value = { isPending: false, isError: false, data: [], refetch: () => undefined }
})

describe('team resolution', () => {
  it('shows a loading state while teams resolve', () => {
    hoisted.active.value = activeTeam({ isLoading: true, team: null, teamId: null })
    renderScreen()
    expect(screen.getByRole('status', { name: /loading/i })).toBeInTheDocument()
  })

  it('shows the no-team empty state when none can be managed', () => {
    hoisted.active.value = activeTeam({ teamId: null, team: null })
    renderScreen()
    expect(screen.getByText(/don't manage a team|no teams/i)).toBeInTheDocument()
  })
})

describe('Matchday section (AC2, AC4)', () => {
  it('lists only future, scheduled matches — soonest first', () => {
    hoisted.events.value = {
      isPending: false,
      isError: false,
      data: [
        event({ id: 'm-late', title: 'Later match', starts_at: '2026-09-27T14:00:00Z' }),
        event({ id: 'm-soon', title: 'Sooner match', starts_at: '2026-09-20T14:00:00Z' }),
      ],
      refetch: () => undefined,
    }
    renderScreen()
    const order = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(order).toHaveLength(2)
    expect(order[0]).toContain('Sooner match')
    expect(order[1]).toContain('Later match')
  })

  it('excludes training, social, past and cancelled events (AC4)', () => {
    hoisted.events.value = {
      isPending: false,
      isError: false,
      data: [
        event({ id: 'match', title: 'Real match' }),
        event({ id: 'training', title: 'Tuesday training', type: 'training' }),
        event({ id: 'social', title: 'Night out', type: 'social' }),
        event({ id: 'past', title: 'Old match', starts_at: '2026-09-01T14:00:00Z' }),
        event({ id: 'cancelled', title: 'Called off', status: 'cancelled' }),
      ],
      refetch: () => undefined,
    }
    renderScreen()
    expect(screen.getByText('Real match')).toBeInTheDocument()
    expect(screen.queryByText('Tuesday training')).not.toBeInTheDocument()
    expect(screen.queryByText('Night out')).not.toBeInTheDocument()
    expect(screen.queryByText('Old match')).not.toBeInTheDocument()
    expect(screen.queryByText('Called off')).not.toBeInTheDocument()
  })

  it('links each match to its squad picker (S9.2; AC1)', () => {
    hoisted.events.value = {
      isPending: false,
      isError: false,
      data: [event({ id: 'abc-match', title: 'Real match' })],
      refetch: () => undefined,
    }
    renderScreen()
    expect(screen.getByRole('link', { name: /real match/i })).toHaveAttribute(
      'href',
      '/squad/event/abc-match',
    )
  })

  it('shows the empty state when there are no upcoming matches', () => {
    renderScreen()
    expect(screen.getByText('No upcoming matches.')).toBeInTheDocument()
  })

  it('shows an inline error with retry when the events read fails', () => {
    hoisted.events.value = {
      isPending: false,
      isError: true,
      data: [],
      refetch: () => undefined,
    }
    renderScreen()
    expect(screen.getByText("Couldn't load matches.")).toBeInTheDocument()
  })
})

describe('Members section (AC2)', () => {
  it('embeds the S6.4 roster for the active team', () => {
    renderScreen()
    expect(screen.getByTestId('member-list')).toHaveTextContent(TEAM)
    expect(screen.getByText('Members')).toBeInTheDocument()
  })
})
