import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/api/events'
import type { EventResponseRow } from '@/features/availability/schema'
import type { MemberDirectoryRow } from '@/features/teams/schema'

interface QueryLike<T> {
  isPending: boolean
  isError: boolean
  data: T | undefined
  refetch: () => void
}

const hoisted = vi.hoisted(() => {
  const settled = <T,>(data: T): QueryLike<T> => ({
    isPending: false,
    isError: false,
    data,
    refetch: vi.fn(),
  })
  const pending = <T,>(): QueryLike<T> => ({
    isPending: true,
    isError: false,
    data: undefined,
    refetch: vi.fn(),
  })
  const errored = <T,>(): QueryLike<T> => ({
    isPending: false,
    isError: true,
    data: undefined,
    refetch: vi.fn(),
  })
  return {
    detail: { value: pending<EventDetail | null>() },
    responses: { value: pending<EventResponseRow[]>() },
    members: { value: pending<MemberDirectoryRow[]>() },
    settled,
    pending,
    errored,
  }
})

vi.mock('@/api/events', () => ({
  useEventDetail: () => hoisted.detail.value,
  useEventResponses: () => hoisted.responses.value,
}))
vi.mock('@/api/members', () => ({ useTeamMembers: () => hoisted.members.value }))
// The overflow menu's dialogs own mutation hooks that reach the query cache; stub them so this
// screen test is about states and counts, not their behaviour (covered by the S4.2 tests).
vi.mock('@/features/events/components/EventFormDialog', () => ({ EventFormDialog: () => null }))
vi.mock('@/features/events/components/CancelEventDialog', () => ({ CancelEventDialog: () => null }))
vi.mock('@/features/events/components/DeleteEventDialog', () => ({ DeleteEventDialog: () => null }))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => ({ status: 'ready', user: { isAdmin: false } }),
}))
vi.mock('@/lib/serverClock', () => ({ serverNow: () => new Date('2026-09-10T00:00:00Z') }))

const ManageEventScreen = (await import('@/features/events/manage-event-screen')).default

const ID = '00000000-0000-4000-8000-000000000102'
const TEAM_ID = '00000000-0000-4000-8000-000000000001'

const detail = (over: Partial<EventDetail> = {}): EventDetail => ({
  id: ID,
  teamId: TEAM_ID,
  teamName: 'Firsts',
  type: 'training',
  title: 'Evening session',
  location: 'Dalymount Park',
  notes: 'Bring both kits.',
  startsAt: '2026-09-15T07:35:08.303+00:00',
  status: 'scheduled',
  myResponse: null,
  ...over,
})

const member = (id: string): MemberDirectoryRow => ({
  user_id: id,
  name: `Player ${id}`,
  role: 'player',
  joined_at: '2026-01-01T00:00:00+00:00',
  phone: null,
})
const response = (id: string, r: EventResponseRow['response']): EventResponseRow => ({
  event_id: ID,
  user_id: id,
  response: r,
  updated_at: '2026-09-10T00:00:00+00:00',
})

// The seeded event 102 shape: 12 members, one response from a leaver among ten rows.
const squad12 = Array.from({ length: 12 }, (_, i) => member(`m${String(i)}`))
const responsesWithLeaver: EventResponseRow[] = [
  ...Array.from({ length: 6 }, (_, i) => response(`m${String(i)}`, 'available')),
  ...Array.from({ length: 3 }, (_, i) => response(`m${String(i + 6)}`, 'unavailable')),
  response('leaver', 'available'),
]

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/manage/event/${ID}`]}>
      <Routes>
        <Route path="/manage/event/:id" element={<ManageEventScreen />} />
        <Route path="/manage" element={<div>manage list</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The tile is a Card holding a number span over a label span; find it by its label. */
function tileValue(label: string): string {
  const card = screen.getByText(label).closest('[data-slot="card"]')
  expect(card).not.toBeNull()
  // The first span in the tile is the number.
  return within(card as HTMLElement).getAllByText(/^\d+$/)[0]?.textContent ?? ''
}

beforeEach(() => {
  hoisted.detail.value = hoisted.pending<EventDetail | null>()
  hoisted.responses.value = hoisted.pending<EventResponseRow[]>()
  hoisted.members.value = hoisted.pending<MemberDirectoryRow[]>()
})

describe('ManageEventScreen', () => {
  it('shows a loading skeleton while the event is loading', () => {
    hoisted.detail.value = hoisted.pending<EventDetail | null>()
    renderScreen()
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
    expect(screen.queryByText('Evening session')).toBeNull()
  })

  it('shows Event not found for an unknown or unmanaged event (AC10)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(null)
    renderScreen()
    expect(screen.getByText('Event not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to manage/i })).toBeInTheDocument()
  })

  it('derives and renders the four counts, excluding a leaver response (AC3, AC5)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled(responsesWithLeaver)
    hoisted.members.value = hoisted.settled(squad12)
    renderScreen()

    expect(screen.getByText('Evening session')).toBeInTheDocument()
    expect(tileValue('Available')).toBe('6')
    expect(tileValue('Unavailable')).toBe('3')
    expect(tileValue('Awaiting')).toBe('3')
    expect(tileValue('Squad')).toBe('12')
    expect(screen.getByText('Player list coming next.')).toBeInTheDocument()
  })

  it('renders four zeros and the empty message for a squad of none (AC12)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>([])
    renderScreen()

    expect(tileValue('Squad')).toBe('0')
    expect(tileValue('Awaiting')).toBe('0')
    expect(screen.getByText('No one has joined this team yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /join link/i })).toBeInTheDocument()
  })

  it('shows an inline error in place of the counts on a partial failure, header intact (AC13)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.errored<EventResponseRow[]>()
    hoisted.members.value = hoisted.settled(squad12)
    renderScreen()

    expect(screen.getByText('Evening session')).toBeInTheDocument()
    expect(screen.getByText("Couldn't load the responses.")).toBeInTheDocument()
    expect(screen.queryByText('Squad')).toBeNull()
  })

  it('shows the cancelled banner and still renders the counts (AC8)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail({ status: 'cancelled' }))
    hoisted.responses.value = hoisted.settled(responsesWithLeaver)
    hoisted.members.value = hoisted.settled(squad12)
    renderScreen()

    expect(screen.getByText("This one's off.")).toBeInTheDocument()
    expect(tileValue('Squad')).toBe('12')
  })
})
