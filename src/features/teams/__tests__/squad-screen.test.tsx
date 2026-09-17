import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
// The selection row reads the per-match squad for its status hint (S9.2); a stub keeps this suite
// about the lists, not the squad read. Undefined data renders the "Squad not picked" hint.
vi.mock('@/api/squad', () => ({ useEventSquad: () => ({ data: undefined }) }))
// Convenience-role flag only; not under test here.
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => ({ status: 'ready', user: { isAdmin: false } }),
}))
// The header is exercised by its own suite; a light stub keeps this about the sections.
vi.mock('@/features/teams/components/ManageHeader', () => ({
  ManageHeader: () => <div data-testid="manage-header" />,
}))
// The S6.4 roster is embedded, not re-tested here.
vi.mock('@/features/teams/member-list', () => ({
  MemberList: ({ teamId }: { teamId: string }) => <div data-testid="member-list">{teamId}</div>,
}))

const SquadScreen = (await import('@/features/teams/squad-screen')).default

/** A minimal EventRow — the sections read id, type, status, title, location, starts_at, meet_at,
 *  and score_us/score_them for the Game Stats hint. */
function event(over: Partial<EventRow> & Pick<EventRow, 'id'>): EventRow {
  return {
    team_id: TEAM,
    type: 'match',
    title: 'Match',
    location: 'Bogies',
    notes: null,
    opponent: 'Kilbarrack',
    home_away: 'home',
    jersey: null,
    motm_user_id: null,
    score_us: null,
    score_them: null,
    first_half_kickoff_at: null,
    half_time_at: null,
    second_half_kickoff_at: null,
    full_time_at: null,
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

/** Tap one of the three segmented-control tabs. */
const switchTo = (name: 'Selection' | 'Game Stats' | 'Members') =>
  userEvent.click(screen.getByRole('radio', { name }))

const withEvents = (data: EventRow[]) => {
  hoisted.events.value = { isPending: false, isError: false, data, refetch: () => undefined }
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

describe('the segmented switch (Chris, 2026-09-16)', () => {
  it('offers the three views and shows Selection first', () => {
    withEvents([event({ id: 'up', title: 'Upcoming', starts_at: '2026-09-20T14:00:00Z' })])
    renderScreen()
    for (const name of ['Selection', 'Game Stats', 'Members', 'Subs']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument()
    }
    // Selection is the default view: its match shows, the members roster does not.
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
    expect(screen.queryByTestId('member-list')).not.toBeInTheDocument()
  })

  it('swaps the visible view when another tab is tapped', async () => {
    withEvents([
      event({ id: 'up', title: 'Upcoming', starts_at: '2026-09-20T14:00:00Z' }),
      event({ id: 'past', title: 'Played', starts_at: '2026-09-10T14:00:00Z' }),
    ])
    renderScreen()
    expect(screen.getByText('Upcoming')).toBeInTheDocument()

    await switchTo('Game Stats')
    expect(screen.getByText('Played')).toBeInTheDocument()
    expect(screen.queryByText('Upcoming')).not.toBeInTheDocument()

    await switchTo('Members')
    expect(screen.getByTestId('member-list')).toHaveTextContent(TEAM)
    expect(screen.queryByText('Played')).not.toBeInTheDocument()
  })
})

describe('Selection view (S17.2 AC1)', () => {
  it('lists only future, scheduled matches — soonest first', () => {
    withEvents([
      event({ id: 'm-late', title: 'Later match', starts_at: '2026-09-27T14:00:00Z' }),
      event({ id: 'm-soon', title: 'Sooner match', starts_at: '2026-09-20T14:00:00Z' }),
    ])
    renderScreen()
    const order = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(order).toHaveLength(2)
    expect(order[0]).toContain('Sooner match')
    expect(order[1]).toContain('Later match')
  })

  it('excludes training, social, past and cancelled events', () => {
    withEvents([
      event({ id: 'match', title: 'Real match' }),
      event({ id: 'training', title: 'Tuesday training', type: 'training' }),
      event({ id: 'social', title: 'Night out', type: 'social' }),
      event({ id: 'past', title: 'Old match', starts_at: '2026-09-01T14:00:00Z' }),
      event({ id: 'cancelled', title: 'Called off', status: 'cancelled' }),
    ])
    renderScreen()
    expect(screen.getByText('Real match')).toBeInTheDocument()
    expect(screen.queryByText('Tuesday training')).not.toBeInTheDocument()
    expect(screen.queryByText('Night out')).not.toBeInTheDocument()
    expect(screen.queryByText('Old match')).not.toBeInTheDocument()
    expect(screen.queryByText('Called off')).not.toBeInTheDocument()
  })

  it('links each match to its squad picker (S9.2)', () => {
    withEvents([event({ id: 'abc-match', title: 'Real match' })])
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
    hoisted.events.value = { isPending: false, isError: true, data: [], refetch: () => undefined }
    renderScreen()
    expect(screen.getByText("Couldn't load matches.")).toBeInTheDocument()
  })
})

describe('Game Stats view (S17.2 AC2, AC3)', () => {
  it('lists kicked-off matches, most recent first, each linking to its collection screen', async () => {
    withEvents([
      event({ id: 'g-older', title: 'Older game', starts_at: '2026-09-05T14:00:00Z' }),
      event({ id: 'g-recent', title: 'Recent game', starts_at: '2026-09-12T14:00:00Z' }),
    ])
    renderScreen()
    await switchTo('Game Stats')
    const order = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(order).toHaveLength(2)
    expect(order[0]).toContain('Recent game')
    expect(order[1]).toContain('Older game')
    expect(screen.getByRole('link', { name: /recent game/i })).toHaveAttribute(
      'href',
      '/squad/game-stats/g-recent',
    )
  })

  it('shows the final score once entered, otherwise a prompt to add stats', async () => {
    withEvents([
      event({
        id: 'g-scored',
        title: 'Scored game',
        starts_at: '2026-09-12T14:00:00Z',
        score_us: 3,
        score_them: 1,
      }),
      event({ id: 'g-open', title: 'Open game', starts_at: '2026-09-11T14:00:00Z' }),
    ])
    renderScreen()
    await switchTo('Game Stats')
    expect(screen.getByText(/Final 3.1/)).toBeInTheDocument()
    expect(screen.getByText('Add match stats')).toBeInTheDocument()
  })

  it('excludes upcoming, training and cancelled matches', async () => {
    withEvents([
      event({ id: 'played', title: 'Played match', starts_at: '2026-09-10T14:00:00Z' }),
      event({ id: 'upcoming', title: 'Upcoming match', starts_at: '2026-09-20T14:00:00Z' }),
      event({
        id: 'past-training',
        title: 'Past training',
        type: 'training',
        starts_at: '2026-09-10T14:00:00Z',
      }),
      event({
        id: 'past-cancelled',
        title: 'Past cancelled',
        status: 'cancelled',
        starts_at: '2026-09-10T14:00:00Z',
      }),
    ])
    renderScreen()
    await switchTo('Game Stats')
    expect(screen.getByText('Played match')).toBeInTheDocument()
    expect(screen.queryByText('Upcoming match')).not.toBeInTheDocument()
    expect(screen.queryByText('Past training')).not.toBeInTheDocument()
    expect(screen.queryByText('Past cancelled')).not.toBeInTheDocument()
  })

  it('shows a match from an hour before kick-off, before it has started (S18.3)', async () => {
    // NOW is 12:00; a match at 12:30 is 30 min away — inside the one-hour lead — so it shows here
    // even though it hasn't kicked off. A match six days out does not.
    withEvents([
      event({ id: 'soon', title: 'Kicking off soon', starts_at: '2026-09-14T12:30:00Z' }),
      event({ id: 'far', title: 'Days away', starts_at: '2026-09-20T14:00:00Z' }),
    ])
    renderScreen()
    await switchTo('Game Stats')
    expect(screen.getByText('Kicking off soon')).toBeInTheDocument()
    expect(screen.queryByText('Days away')).not.toBeInTheDocument()
  })

  it('shows an empty state when no match is within the window yet', async () => {
    withEvents([event({ id: 'future', starts_at: '2026-09-20T14:00:00Z' })])
    renderScreen()
    await switchTo('Game Stats')
    expect(screen.getByText('No matches to score yet.')).toBeInTheDocument()
  })
})

describe('Members view (S17.2 AC1)', () => {
  it('embeds the S6.4 roster for the active team', async () => {
    renderScreen()
    await switchTo('Members')
    expect(screen.getByTestId('member-list')).toHaveTextContent(TEAM)
  })
})
