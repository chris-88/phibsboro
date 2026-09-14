import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import type { UpcomingEvent } from '@/api/events'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import type { CurrentUser, TeamMembership } from '@/features/auth/use-current-user'

// The one write the buttons make, controllable per test (mirrors the S3.3 buttons test).
const upsert = vi.fn<(...args: unknown[]) => Promise<{ error: unknown }>>()
vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ upsert: (...args: unknown[]) => upsert(...args) }) },
}))

interface QueryLike {
  data: UpcomingEvent[] | undefined
  isError: boolean
  isSuccess: boolean
  refetch: () => void
}

const hoisted = vi.hoisted(() => ({
  query: { value: undefined as unknown as QueryLike },
  memberships: { value: [] as TeamMembership[] },
}))

vi.mock('@/api/events', () => ({ useUpcomingEvents: () => hoisted.query.value }))
vi.mock('@/features/auth/use-current-user', () => ({
  useSignedInUser: (): Pick<CurrentUser, 'memberships'> => ({
    memberships: hoisted.memberships.value,
  }),
}))

const HomeScreen = (await import('@/features/events/routes/HomeScreen')).default
const { AvailabilityButtons } =
  await import('@/features/availability/components/AvailabilityButtons')
const { eventKeys } = await import('@/api/queryKeys')

const USER_ID = '00000000-0000-4000-8000-0000000000aa'
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

const upcoming = (over: Partial<UpcomingEvent> = {}): UpcomingEvent => ({
  id: EVENT_ID,
  teamId: '00000000-0000-4000-8000-000000000001',
  teamName: 'Firsts',
  type: 'match',
  title: 'Firsts v Shelbourne',
  location: 'Tolka Park',
  startsAt: '2026-09-15T18:00:00.000+00:00',
  status: 'scheduled',
  myResponse: null,
  ...over,
})

const settled = (data: UpcomingEvent[]): QueryLike => ({
  data,
  isError: false,
  isSuccess: true,
  refetch: vi.fn(),
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
  hoisted.memberships.value = [membership('00000000-0000-4000-8000-000000000001', 'Firsts')]
  hoisted.query.value = settled([upcoming()])
})

describe('HomeScreen (S3.1) — states', () => {
  it('renders one next-event card with badge, title, date and location (AC1, AC2)', () => {
    renderHome()
    expect(screen.getByText('Match')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Firsts v Shelbourne' })).toBeInTheDocument()
    expect(screen.getByText('Tolka Park')).toBeInTheDocument()
    // The one date line, through formatEventTime (Dublin, IST in September).
    expect(screen.getByText('Tuesday 15 September, 7pm')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
  })

  it('shows the next scheduled event, skipping a cancelled one that sorts first (AC4)', () => {
    hoisted.query.value = settled([
      upcoming({ id: 'cancelled-id', status: 'cancelled', title: 'Called off' }),
      upcoming({ id: 'scheduled-id', title: 'The real next one' }),
    ])
    renderHome()
    expect(screen.getByRole('heading', { name: 'The real next one' })).toBeInTheDocument()
    expect(screen.queryByText('Called off')).not.toBeInTheDocument()
  })

  it('shows the team name when the player is on more than one team (AC3)', () => {
    hoisted.memberships.value = [
      membership('00000000-0000-4000-8000-000000000001', 'Firsts'),
      membership('00000000-0000-4000-8000-000000000002', 'Reserves'),
    ]
    renderHome()
    expect(screen.getByText('Firsts')).toBeInTheDocument()
  })

  it('omits the team name when the player is on exactly one team (AC3)', () => {
    renderHome()
    expect(screen.queryByText('Firsts')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Firsts v Shelbourne' })).toBeInTheDocument()
  })

  it('shows the no-team empty state and no card when there are no memberships (AC12)', () => {
    hoisted.memberships.value = []
    renderHome()
    expect(screen.getByText("You're not on a team yet.")).toBeInTheDocument()
    expect(screen.getByText('Ask your manager for a join link.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('shows the nothing-coming-up empty state with a membership but no scheduled event (AC11)', () => {
    hoisted.query.value = settled([])
    renderHome()
    expect(screen.getByText('Nothing coming up.')).toBeInTheDocument()
    expect(screen.getByText('Your manager will post the next one here.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('falls to nothing-coming-up when the only upcoming event is cancelled (AC4, AC11)', () => {
    hoisted.query.value = settled([upcoming({ status: 'cancelled' })])
    renderHome()
    expect(screen.getByText('Nothing coming up.')).toBeInTheDocument()
  })

  it('shows a loading skeleton, same-height, while the query is pending (AC13)', () => {
    hoisted.query.value = { data: undefined, isError: false, isSuccess: false, refetch: vi.fn() }
    renderHome()
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('shows an inline error with a Retry that refetches, keeping no card (AC14)', async () => {
    const refetch = vi.fn()
    hoisted.query.value = { data: undefined, isError: true, isSuccess: false, refetch }
    renderHome()
    expect(screen.getByText("Couldn't load your events.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})

describe('HomeScreen (S3.1) — the answer on the card', () => {
  it('marks the chosen answer pressed with a confirming line on return (AC8)', () => {
    hoisted.query.value = settled([upcoming({ myResponse: 'available' })])
    renderHome()
    expect(screen.getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('You said yes.')).toBeInTheDocument()
  })

  it('shows neither confirming line for an unanswered event (AC8)', () => {
    renderHome()
    expect(screen.queryByText('You said yes.')).not.toBeInTheDocument()
    expect(screen.queryByText('You said no.')).not.toBeInTheDocument()
  })

  it('fires no request when the already-selected answer is tapped (AC9)', async () => {
    hoisted.query.value = settled([upcoming({ myResponse: 'available' })])
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('HomeScreen (S3.1) — the card as a link (AC17)', () => {
  it('navigates to the event when the card body is tapped', async () => {
    renderHome()
    await userEvent.click(screen.getByRole('heading', { name: 'Firsts v Shelbourne' }))
    expect(await screen.findByText('event page')).toBeInTheDocument()
  })

  it('records the answer and does not navigate when YES is tapped', async () => {
    upsert.mockResolvedValue({ error: null })
    renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(upsert).toHaveBeenCalledWith(
      { event_id: EVENT_ID, user_id: USER_ID, response: 'available' },
      { onConflict: 'event_id,user_id' },
    )
    expect(screen.queryByText('event page')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Firsts v Shelbourne' })).toBeInTheDocument()
  })
})

// The card reads its `current` from the upcoming cache, so the optimistic write and its rollback
// must touch that cache, not only the detail cache (the S3.1 addition to useSetResponse). This
// harness reads the upcoming cache exactly as the screen does, so the button state is observable.
describe('the home card optimistic write against the upcoming cache (AC7, AC10)', () => {
  function UpcomingHarness(): React.JSX.Element {
    const q = useQuery<UpcomingEvent[]>({
      queryKey: eventKeys.upcoming(USER_ID),
      queryFn: () => Promise.reject(new Error('must not fetch')),
      enabled: false,
    })
    const ev = q.data?.[0]
    return ev ? <AvailabilityButtons eventId={ev.id} current={ev.myResponse} /> : <div />
  }

  function renderHarness(initial: UpcomingEvent): QueryClient {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(eventKeys.upcoming(USER_ID), [initial])
    render(
      <QueryClientProvider client={client}>
        <SessionContext.Provider value={signedIn}>
          <UpcomingHarness />
        </SessionContext.Provider>
      </QueryClientProvider>,
    )
    return client
  }

  const yes = () => screen.getByRole('button', { name: 'Yes' })
  const no = () => screen.getByRole('button', { name: 'No' })

  it('fills the tapped button before the request resolves (AC7)', async () => {
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

  it('rolls the card back and shows the failure line when the write fails (AC10)', async () => {
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
    expect(yes()).toBeEnabled()
    expect(no()).toBeEnabled()
  })
})
