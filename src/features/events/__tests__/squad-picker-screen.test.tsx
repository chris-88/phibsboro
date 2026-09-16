import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventDetail } from '@/api/events'
import type { EventResponseRow } from '@/features/availability/schema'
import type { SquadRow } from '@/features/events/schema'
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
    squad: { value: pending<SquadRow[]>() },
    setMember: vi.fn(),
    setCaptain: vi.fn(),
    removeMember: vi.fn(),
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
vi.mock('@/api/squad', () => ({
  useEventSquad: () => hoisted.squad.value,
  useSetSquadMember: () => ({ mutate: hoisted.setMember }),
  useSetCaptain: () => ({ mutate: hoisted.setCaptain }),
  useRemoveSquadMember: () => ({ mutate: hoisted.removeMember }),
}))

const SquadPickerScreen = (await import('@/features/events/squad-picker-screen')).default

const ID = '00000000-0000-4000-8000-000000000102'
const TEAM_ID = '00000000-0000-4000-8000-000000000001'

const detail = (over: Partial<EventDetail> = {}): EventDetail => ({
  id: ID,
  teamId: TEAM_ID,
  teamName: 'Firsts',
  type: 'match',
  title: 'Phibsboro vs Bohemians',
  location: 'Dalymount Park',
  notes: null,
  opponent: 'Bohemians',
  homeAway: 'home',
  jersey: null,
  meetAt: null,
  startsAt: '2026-09-15T14:00:00+00:00',
  status: 'scheduled',
  myResponse: null,
  ...over,
})

const member = (id: string, name: string): MemberDirectoryRow => ({
  user_id: id,
  name,
  role: 'player',
  joined_at: '2026-01-01T00:00:00+00:00',
  phone: null,
})
const response = (id: string, r: EventResponseRow['response']): EventResponseRow => ({
  event_id: ID,
  user_id: id,
  response: r,
  reason: null,
  updated_at: '2026-09-10T00:00:00+00:00',
})
const pick = (id: string, n: number, cap = false): SquadRow => ({
  event_id: ID,
  user_id: id,
  shirt_number: n,
  is_captain: cap,
  recorded_by: 'mgr',
  updated_at: '2026-09-10T00:00:00+00:00',
})

const members = [member('a', 'Aaron'), member('b', 'Ben'), member('c', 'Cian')]

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={[`/squad/event/${ID}`]}>
      <Routes>
        <Route path="/squad/event/:id" element={<SquadPickerScreen />} />
        <Route path="/squad" element={<div>squad hub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hoisted.detail.value = hoisted.pending<EventDetail | null>()
  hoisted.responses.value = hoisted.pending<EventResponseRow[]>()
  hoisted.members.value = hoisted.pending<MemberDirectoryRow[]>()
  hoisted.squad.value = hoisted.pending<SquadRow[]>()
  hoisted.setMember.mockReset()
  hoisted.setCaptain.mockReset()
  hoisted.removeMember.mockReset()
})

describe('SquadPickerScreen (S9.2)', () => {
  it('shows a skeleton while the event loads', () => {
    renderScreen()
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })

  it('renders the not-found screen when the event is null (unmanaged/unknown)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(null)
    renderScreen()
    expect(screen.getByText('Event not found.')).toBeInTheDocument()
  })

  it('refuses training/social: squads are match-only (AC6)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail({ type: 'training' }))
    renderScreen()
    expect(screen.getByText('Squads are for matches only.')).toBeInTheDocument()
  })

  it('shows the empty state when no one is available yet', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([])
    renderScreen()
    expect(screen.getByText("No one's available yet.")).toBeInTheDocument()
  })

  it('lists available players and shows the n / 20 count', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([
      response('a', 'available'),
      response('b', 'available'),
      response('c', 'unavailable'),
    ])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([pick('a', 1)])
    renderScreen()
    expect(screen.getByText('1 / 20')).toBeInTheDocument()
    // Ben is available and not picked; Cian is unavailable so never offered.
    expect(screen.getByRole('button', { name: `Remove Aaron from the squad` })).toBeInTheDocument()
    expect(screen.getByText('Ben')).toBeInTheDocument()
    expect(screen.queryByText('Cian')).not.toBeInTheDocument()
  })

  it('adds an available player with the lowest free number', async () => {
    const user = userEvent.setup()
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([
      response('a', 'available'),
      response('b', 'available'),
    ])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([pick('a', 1)])
    renderScreen()
    // The pool row for Ben carries the Add button; number 1 is taken so next free is 2.
    const benRow = screen.getByText('Ben').closest('li') as HTMLElement
    await user.click(within(benRow).getByRole('button', { name: 'Add' }))
    expect(hoisted.setMember).toHaveBeenCalledWith(
      { userId: 'b', shirtNumber: 2, isCaptain: false },
      expect.anything(),
    )
  })

  it('marks a captain, passing the previous captain to clear (AC4)', async () => {
    const user = userEvent.setup()
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([
      response('a', 'available'),
      response('b', 'available'),
    ])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([pick('a', 1, true), pick('b', 2)])
    renderScreen()
    const benRow = screen.getByText('Ben').closest('li') as HTMLElement
    await user.click(within(benRow).getByRole('button', { name: 'Captain' }))
    expect(hoisted.setCaptain).toHaveBeenCalledWith(
      {
        userId: 'b',
        shirtNumber: 2,
        makeCaptain: true,
        previousCaptain: { userId: 'a', shirtNumber: 1 },
      },
      expect.anything(),
    )
  })

  it('removes a picked player (AC2)', async () => {
    const user = userEvent.setup()
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([response('a', 'available')])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([pick('a', 1)])
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Remove Aaron from the squad' }))
    expect(hoisted.removeMember).toHaveBeenCalledWith('a', expect.anything())
  })

  it('flags a picked player who is no longer available (AC5)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    // Aaron is picked but has no available response any more.
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([response('b', 'available')])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([pick('a', 4)])
    renderScreen()
    const aaronRow = screen.getByText('Aaron').closest('li') as HTMLElement
    expect(within(aaronRow).getByText('Not available')).toBeInTheDocument()
    // still removable
    expect(
      within(aaronRow).getByRole('button', { name: 'Remove Aaron from the squad' }),
    ).toBeInTheDocument()
  })

  it('shows the error state when a read fails, with a retry', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.errored<EventResponseRow[]>()
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([])
    renderScreen()
    expect(screen.getByText("Couldn't load the squad.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  // Chris, 2026-09-16 — the numbered teamsheet is shared from the Squad view (here), not the
  // Schedule tab, which keeps only the availability invite + reminder.
  it('shares the picked teamsheet from the Squad view once a side is chosen', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([
      response('a', 'available'),
      response('b', 'available'),
    ])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([pick('a', 1), pick('b', 7, true)])
    renderScreen()
    const link = screen.getByRole('link', { name: 'Share squad to WhatsApp' })
    const body = decodeURIComponent(
      (link.getAttribute('href') ?? '').slice('https://wa.me/?text='.length),
    )
    expect(body).toContain('Firsts vs Bohemians')
    expect(body).toContain('Squad:')
    expect(body).toContain(' 1. Aaron')
    expect(body).toContain(' 7. Ben (C)')
  })

  it('offers no squad share until someone is picked', () => {
    hoisted.detail.value = hoisted.settled<EventDetail | null>(detail())
    hoisted.responses.value = hoisted.settled<EventResponseRow[]>([response('a', 'available')])
    hoisted.members.value = hoisted.settled<MemberDirectoryRow[]>(members)
    hoisted.squad.value = hoisted.settled<SquadRow[]>([])
    renderScreen()
    expect(screen.queryByRole('link', { name: 'Share squad to WhatsApp' })).not.toBeInTheDocument()
  })
})
