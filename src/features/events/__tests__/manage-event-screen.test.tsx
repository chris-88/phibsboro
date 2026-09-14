import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/api/events'
import type { EventResponseRow } from '@/features/availability/schema'
import type { MemberDirectoryRow } from '@/features/teams/schema'
import type { RosterAttendance } from '@/lib/roster'

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
    attendance: { value: pending<RosterAttendance[]>() },
    settled,
    pending,
    errored,
  }
})

vi.mock('@/api/events', () => ({
  useEventDetail: () => hoisted.detail.value,
  useEventResponses: () => hoisted.responses.value,
  useEventAttendance: () => hoisted.attendance.value,
}))
vi.mock('@/api/members', () => ({ useTeamMembers: () => hoisted.members.value }))
// The S4.5 attendance mutations reach the query cache; this screen test is about states and
// counts, so stub them. Their behaviour is covered by the attendance hook tests.
vi.mock('@/api/attendance', () => ({
  useSetAttendance: () => ({ mutate: vi.fn(), isPending: false }),
  useBulkMarkAttended: () => ({ mutate: vi.fn(), isPending: false }),
}))
// The overflow menu's dialogs own mutation hooks that reach the query cache; stub them so this
// screen test is about states and counts, not their behaviour (covered by the S4.2 tests).
vi.mock('@/features/events/components/EventFormDialog', () => ({ EventFormDialog: () => null }))
vi.mock('@/features/events/components/CancelEventDialog', () => ({ CancelEventDialog: () => null }))
vi.mock('@/features/events/components/DeleteEventDialog', () => ({ DeleteEventDialog: () => null }))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => ({
    status: 'ready',
    user: { isAdmin: false, isManagerOf: () => true },
  }),
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
  opponent: null,
  homeAway: null,
  meetAt: null,
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

/** The tile is a Card holding a number span over a label span; find it by its label. Scoped to
 *  the counts group, because the same words now appear on the response pills below (S4.4). */
function tileValue(label: string): string {
  const panel = screen.getByRole('group', { name: 'Response counts' })
  const card = within(panel).getByText(label).closest('[data-slot="card"]')
  expect(card).not.toBeNull()
  // The first span in the tile is the number.
  return within(card as HTMLElement).getAllByText(/^\d+$/)[0]?.textContent ?? ''
}

beforeEach(() => {
  hoisted.detail.value = hoisted.pending<EventDetail | null>()
  hoisted.responses.value = hoisted.pending<EventResponseRow[]>()
  hoisted.members.value = hoisted.pending<MemberDirectoryRow[]>()
  hoisted.attendance.value = hoisted.pending<RosterAttendance[]>()
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
    hoisted.attendance.value = hoisted.settled<RosterAttendance[]>([])
    renderScreen()

    expect(screen.getByText('Evening session')).toBeInTheDocument()
    expect(tileValue('Available')).toBe('6')
    expect(tileValue('Unavailable')).toBe('3')
    expect(tileValue('Awaiting')).toBe('3')
    expect(tileValue('Squad')).toBe('12')
  })

  it('renders one card per member and drops the placeholder line (AC1, AC4)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled(responsesWithLeaver)
    hoisted.members.value = hoisted.settled(squad12)
    hoisted.attendance.value = hoisted.settled<RosterAttendance[]>([])
    renderScreen()

    expect(screen.queryByText('Player list coming next.')).toBeNull()
    // 12 members → 12 cards, the leaver's orphaned response contributing none.
    for (let i = 0; i < 12; i++) {
      expect(screen.getByText(`Player m${String(i)}`)).toBeInTheDocument()
    }
    expect(screen.queryByText('Player leaver')).toBeNull()
    // S4.5 supplies the handler, so every attendance control is now live (AC1).
    const controls = screen.getAllByRole('radio', { name: 'Not recorded' })
    expect(controls).toHaveLength(12)
    for (const c of controls) expect(c).toBeEnabled()
  })

  it('shows the roster skeleton while attendance is still loading (AC11)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled(responsesWithLeaver)
    hoisted.members.value = hoisted.settled(squad12)
    hoisted.attendance.value = hoisted.pending<RosterAttendance[]>()
    renderScreen()

    expect(screen.getByLabelText('Loading the squad')).toBeInTheDocument()
  })

  it('shows an inline squad error with Retry when attendance fails (AC11)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled(responsesWithLeaver)
    hoisted.members.value = hoisted.settled(squad12)
    hoisted.attendance.value = hoisted.errored<RosterAttendance[]>()
    renderScreen()

    // Header and counts stay on screen; only the squad region shows its error.
    expect(screen.getByText('Evening session')).toBeInTheDocument()
    expect(tileValue('Squad')).toBe('12')
    expect(screen.getByText("Couldn't load the squad.")).toBeInTheDocument()
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

  it('S4.5: live attendance controls and an enabled bulk button for a scheduled event (AC1, AC6)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled(responsesWithLeaver)
    hoisted.members.value = hoisted.settled(squad12)
    hoisted.attendance.value = hoisted.settled<RosterAttendance[]>([])
    renderScreen()

    // Six members are available, so the bulk action is offered and enabled.
    expect(screen.getByRole('button', { name: 'Mark available as attended' })).toBeEnabled()
    expect(screen.getAllByRole('radio', { name: 'Attended' })[0]).toBeEnabled()
  })

  it('S4.5: the bulk button is disabled when nobody is available (AC6)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([
      response('m0', 'unavailable'),
      response('m1', 'unavailable'),
    ])
    hoisted.members.value = hoisted.settled(squad12)
    hoisted.attendance.value = hoisted.settled<RosterAttendance[]>([])
    renderScreen()

    expect(screen.getByRole('button', { name: 'Mark available as attended' })).toBeDisabled()
  })

  it('S4.5: a cancelled event disables the controls and bulk button, with the line (AC8)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail({ status: 'cancelled' }))
    hoisted.responses.value = hoisted.settled(responsesWithLeaver)
    hoisted.members.value = hoisted.settled(squad12)
    hoisted.attendance.value = hoisted.settled<RosterAttendance[]>([])
    renderScreen()

    expect(screen.getByRole('button', { name: 'Mark available as attended' })).toBeDisabled()
    expect(screen.getAllByRole('radio', { name: 'Not recorded' })[0]).toBeDisabled()
    expect(screen.getAllByText('Cancelled — nothing to record.')[0]).toBeInTheDocument()
  })

  it('S4.5: no bulk button for an empty squad (AC6)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>([])
    hoisted.attendance.value = hoisted.settled<RosterAttendance[]>([])
    renderScreen()

    expect(screen.queryByRole('button', { name: 'Mark available as attended' })).toBeNull()
  })
})
