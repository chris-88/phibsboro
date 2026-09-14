import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import type { UpcomingEvent } from '@/api/events'
import type { Team } from '@/features/teams/schema'
import { TEAM_PALETTE } from '@/features/teams/palette'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import type { CurrentUser, TeamMembership } from '@/features/auth/use-current-user'

// The one write the buttons make, controllable per test (mirrors the S3.3 buttons test).
const upsert = vi.fn<(...args: unknown[]) => Promise<{ error: unknown }>>()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }) },
}))

interface QueryLike<T> {
  data: T | undefined
  isError: boolean
  isSuccess: boolean
  refetch: () => void
}

const hoisted = vi.hoisted(() => ({
  upcoming: { value: undefined as unknown as QueryLike<UpcomingEvent[]> },
  month: { value: undefined as unknown as QueryLike<UpcomingEvent[]> },
  teams: { value: undefined as unknown as QueryLike<Team[]> },
  memberships: { value: [] as TeamMembership[] },
}))

vi.mock('@/api/events', () => ({
  useUpcomingEvents: () => hoisted.upcoming.value,
  useMonthEvents: () => hoisted.month.value,
}))
vi.mock('@/api/teams', () => ({ useTeams: () => hoisted.teams.value }))
vi.mock('@/features/auth/use-current-user', () => ({
  useSignedInUser: (): Pick<CurrentUser, 'id' | 'memberships'> => ({
    id: USER_ID,
    memberships: hoisted.memberships.value,
  }),
}))

const HomeScreen = (await import('@/features/events/routes/HomeScreen')).default
const { AvailabilityButtons } =
  await import('@/features/availability/components/AvailabilityButtons')
const { eventKeys } = await import('@/api/queryKeys')

const USER_ID = '00000000-0000-4000-8000-0000000000aa'
const TEAM_ID = '00000000-0000-4000-8000-000000000001'
const TEAM_2_ID = '00000000-0000-4000-8000-000000000002'
const EVENT_ID = '00000000-0000-4000-8000-000000000102'

const signedIn: SessionState = {
  status: 'signedIn',
  session: { user: { id: USER_ID } } as Session,
}

const membership = (teamId: string, teamName: string): TeamMembership => ({
  teamId,
  teamName,
  role: 'player',
  joinedAt: '2026-01-01T00:00:00.000+00:00',
})

const team = (id: string, colour: string): Team => ({
  id,
  name: id === TEAM_ID ? 'Firsts' : 'Seconds',
  active: true,
  colour,
  created_at: '2026-01-01T00:00:00.000+00:00',
})

const upcoming = (over: Partial<UpcomingEvent> = {}): UpcomingEvent => ({
  id: EVENT_ID,
  teamId: TEAM_ID,
  teamName: 'Firsts',
  type: 'match',
  title: 'Firsts v Shelbourne',
  location: 'Tolka Park',
  // Far future so the S3.4 window stays open in every environment.
  startsAt: '2099-06-13T18:00:00.000+00:00',
  status: 'scheduled',
  myResponse: null,
  ...over,
})

const settled = <T,>(data: T): QueryLike<T> => ({
  data,
  isError: false,
  isSuccess: true,
  refetch: vi.fn(),
})

const pending = <T,>(): QueryLike<T> => ({
  data: undefined,
  isError: false,
  isSuccess: false,
  refetch: vi.fn(),
})

const errored = <T,>(refetch = vi.fn()): QueryLike<T> => ({
  data: undefined,
  isError: true,
  isSuccess: false,
  refetch,
})

function renderHome(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <SessionContext.Provider value={signedIn}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/event/:id" element={<div>event page</div>} />
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  upsert.mockReset()
  hoisted.memberships.value = [membership(TEAM_ID, 'Firsts')]
  hoisted.upcoming.value = settled([upcoming()])
  hoisted.month.value = settled([upcoming()])
  hoisted.teams.value = settled([team(TEAM_ID, TEAM_PALETTE[0].value)])
})

describe('HomeScreen (S10.2) — layout', () => {
  it('shows the condensed next-event card on top with the shared YES / NO (AC1)', () => {
    renderHome()
    expect(screen.getAllByText('Match').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading', { name: 'Firsts v Shelbourne' }).length).toBeGreaterThan(
      0,
    )
    expect(screen.getAllByRole('button', { name: 'Yes' }).length).toBeGreaterThan(0)
  })

  it('replaces the v1.0.0 chronological list with the month calendar (AC1)', () => {
    renderHome()
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.queryByText('Also coming up')).not.toBeInTheDocument()
    expect(screen.queryByText('Nothing else coming up.')).not.toBeInTheDocument()
  })

  it('marks a day that has an event with a dot in the team colour (AC2)', () => {
    renderHome()
    // The default selection is the next event's day; its cell carries a filled team-colour dot.
    const grid = screen.getByRole('grid')
    const dot = grid.querySelector('[style*="background-color"]')
    expect(dot).not.toBeNull()
    expect((dot as HTMLElement).getAttribute('style')).toContain('rgb(30, 64, 175)')
  })
})

describe('HomeScreen (S10.2) — the selected day (AC3, AC5, AC6)', () => {
  it('lists the selected day’s events as cards with YES / NO (AC3)', () => {
    renderHome()
    // The next event's day is selected by default, so its card is in the day list under the grid.
    expect(screen.getAllByRole('button', { name: 'Yes' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Nothing on.')).not.toBeInTheDocument()
  })

  it('shows "Nothing on." for a selected day with no events (AC3)', () => {
    // Next event on the 13th (so that day is selected), but the month's only event is elsewhere.
    hoisted.month.value = settled([
      upcoming({ id: 'other', startsAt: '2099-06-20T18:00:00.000+00:00' }),
    ])
    renderHome()
    expect(screen.getByText('Nothing on.')).toBeInTheDocument()
  })

  it('shows a cancelled event struck-through with a hollow dot, not hidden (AC5)', () => {
    // A scheduled next event fixes the selected day; the same day's cancelled event fills the list.
    hoisted.upcoming.value = settled([upcoming({ id: 'nextid', title: 'Next up' })])
    hoisted.month.value = settled([
      upcoming({ id: 'cx', title: 'Called off', status: 'cancelled' }),
    ])
    renderHome()
    const heading = screen.getByRole('heading', { name: 'Called off' })
    expect(heading.className).toContain('line-through')
    // Cancelled disables the response with the shared "off" line (S3.4).
    expect(screen.getByText("This one's off.")).toBeInTheDocument()
    // The dot is a hollow ring (a border, no fill), never a coloured fill.
    const grid = screen.getByRole('grid')
    expect(grid.querySelector('.border-muted-foreground')).not.toBeNull()
    expect(grid.querySelector('[style*="background-color"]')).toBeNull()
  })

  it('records a response from a day card through the shared mutation (AC6)', async () => {
    upsert.mockResolvedValue({ error: null })
    hoisted.upcoming.value = settled([upcoming({ id: 'nextid', title: 'Next up' })])
    hoisted.month.value = settled([upcoming({ id: 'day13', title: 'On the day' })])
    renderHome()
    // Scope to the day card (its own heading) so it is that card's YES that is tapped.
    const dayCard = screen
      .getByRole('heading', { name: 'On the day' })
      .closest('[data-slot="card"]')
    await userEvent.click(within(dayCard as HTMLElement).getByRole('button', { name: 'Yes' }))
    expect(upsert).toHaveBeenCalledWith(
      { event_id: 'day13', user_id: USER_ID, response: 'available' },
      { onConflict: 'event_id,user_id' },
    )
  })
})

describe('HomeScreen (S10.2) — day selection (AC3)', () => {
  it('shows a tapped day’s events beneath the calendar', async () => {
    // The next event on the 13th shows June 2099 with the 13th selected; the 20th holds another
    // event that only appears once its day is tapped.
    hoisted.upcoming.value = settled([upcoming({ id: 'thirteen' })])
    hoisted.month.value = settled([
      upcoming({ id: 'thirteen' }),
      upcoming({
        id: 'twenty',
        title: 'On the twentieth',
        startsAt: '2099-06-20T18:00:00.000+00:00',
      }),
    ])
    renderHome()
    expect(screen.queryByText('On the twentieth')).not.toBeInTheDocument()
    const grid = screen.getByRole('grid')
    await userEvent.click(within(grid).getByText('20'))
    expect(await screen.findByText('On the twentieth')).toBeInTheDocument()
  })
})

describe('HomeScreen (S10.2) — states (AC8)', () => {
  it('no team: the join-link empty state, no calendar', () => {
    hoisted.memberships.value = []
    renderHome()
    expect(screen.getByText("You're not on a team yet.")).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('loading: a skeleton while a query is pending', () => {
    hoisted.month.value = pending()
    renderHome()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('error: an inline line with a Retry that refetches each failed read', async () => {
    const refetch = vi.fn()
    hoisted.month.value = errored(refetch)
    renderHome()
    expect(screen.getByText("Couldn't load your events.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('empty month with nothing coming up: both empties, no card', () => {
    hoisted.upcoming.value = settled([])
    hoisted.month.value = settled([])
    renderHome()
    expect(screen.getByText('Nothing coming up.')).toBeInTheDocument()
    expect(screen.getByText('Nothing this month.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })
})

describe('HomeScreen (S10.2) — multi-team', () => {
  it('shows two team-colour dots on a day with two teams’ events (AC2)', () => {
    hoisted.memberships.value = [membership(TEAM_ID, 'Firsts'), membership(TEAM_2_ID, 'Seconds')]
    hoisted.teams.value = settled([
      team(TEAM_ID, TEAM_PALETTE[0].value),
      team(TEAM_2_ID, TEAM_PALETTE[1].value),
    ])
    hoisted.upcoming.value = settled([upcoming()])
    hoisted.month.value = settled([
      upcoming(),
      upcoming({ id: 'seconds', teamId: TEAM_2_ID, teamName: 'Seconds' }),
    ])
    renderHome()
    const grid = screen.getByRole('grid')
    const styles = Array.from(grid.querySelectorAll('[style*="background-color"]')).map((el) =>
      el.getAttribute('style'),
    )
    expect(styles.some((s) => s?.includes('rgb(30, 64, 175)'))).toBe(true)
    expect(styles.some((s) => s?.includes('rgb(185, 28, 28)'))).toBe(true)
  })
})

// The day card reads its `current` from a month cache, so the optimistic write and its rollback
// must touch that cache too (the S10.2 addition to useSetResponse). This harness reads a month
// cache exactly as the screen does, so the button state is observable.
describe('the day-card optimistic write against a month cache (AC6)', () => {
  const MONTH_KEY = '2099-06'

  function MonthHarness(): React.JSX.Element {
    const q = useQuery<UpcomingEvent[]>({
      queryKey: eventKeys.month(USER_ID, MONTH_KEY),
      queryFn: () => Promise.reject(new Error('must not fetch')),
      enabled: false,
    })
    const ev = q.data?.[0]
    return ev ? <AvailabilityButtons eventId={ev.id} current={ev.myResponse} /> : <div />
  }

  function renderHarness(initial: UpcomingEvent): void {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(eventKeys.month(USER_ID, MONTH_KEY), [initial])
    render(
      <QueryClientProvider client={client}>
        <SessionContext.Provider value={signedIn}>
          <MonthHarness />
        </SessionContext.Provider>
      </QueryClientProvider>,
    )
  }

  const yes = () => screen.getByRole('button', { name: 'Yes' })
  const no = () => screen.getByRole('button', { name: 'No' })

  it('fills the tapped button before the request resolves (AC6)', async () => {
    let resolve: (v: { error: unknown }) => void = () => undefined
    upsert.mockReturnValue(
      new Promise<{ error: unknown }>((r) => {
        resolve = r
      }),
    )
    renderHarness(upcoming({ myResponse: 'available' }))
    await userEvent.click(no())
    await waitFor(() => {
      expect(no()).toHaveAttribute('aria-pressed', 'true')
    })
    expect(yes()).toHaveAttribute('aria-pressed', 'false')
    resolve({ error: null })
  })

  it('rolls the card back and shows the failure line when the write fails (AC6)', async () => {
    upsert.mockResolvedValue({
      error: { message: 'nope', details: '', hint: '', code: 'P0001', name: 'PostgrestError' },
    })
    renderHarness(upcoming({ myResponse: 'available' }))
    await userEvent.click(no())
    await waitFor(() => {
      expect(screen.getByText("Couldn't save. Tap again.")).toBeInTheDocument()
    })
    expect(yes()).toHaveAttribute('aria-pressed', 'true')
    expect(no()).toHaveAttribute('aria-pressed', 'false')
  })
})
