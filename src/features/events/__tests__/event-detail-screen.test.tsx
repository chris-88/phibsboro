import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import type { EventDetail } from '@/api/events'
import type { EventPreview } from '@/features/events/schema'
import { AppError } from '@/lib/errors'

interface QueryLike<T> {
  isError: boolean
  isSuccess: boolean
  data: T | null
  refetch: () => void
}

const hoisted = vi.hoisted(() => {
  const settled = <T,>(data: T | null): QueryLike<T> => ({
    isError: false,
    isSuccess: true,
    data,
    refetch: vi.fn(),
  })
  const joinMock = (): {
    mutate: ReturnType<typeof vi.fn>
    isPending: boolean
    isError: boolean
    error: unknown
  } => ({ mutate: vi.fn(), isPending: false, isError: false, error: null })
  return {
    detail: { value: settled<EventDetail>(null) },
    preview: { value: settled<EventPreview>(null) },
    join: joinMock(),
    setResponse: { mutate: vi.fn(), isError: false },
    setPendingJoin: vi.fn(),
    setIntendedRoute: vi.fn(),
    settled,
  }
})

vi.mock('@/api/events', () => ({
  useEventDetail: () => hoisted.detail.value,
  useEventPreview: () => hoisted.preview.value,
}))
vi.mock('@/api/joins', () => ({ useJoinTeamByEvent: () => hoisted.join }))
vi.mock('@/api/availability', () => ({ useSetResponse: () => hoisted.setResponse }))
vi.mock('@/features/auth/pending-join', () => ({
  setPendingJoin: hoisted.setPendingJoin,
  clearPendingJoin: vi.fn(),
  readPendingJoin: vi.fn(),
}))
vi.mock('@/lib/intended-route', () => ({
  setIntendedRoute: hoisted.setIntendedRoute,
  takeIntendedRoute: vi.fn(),
  clearIntendedRoute: vi.fn(),
}))

const EventDetailScreen = (await import('@/features/events/routes/EventDetailScreen')).default

const ID = '00000000-0000-4000-8000-000000000104'
const TEAM_ID = '00000000-0000-4000-8000-000000000001'

const signedIn: SessionState = {
  status: 'signedIn',
  session: { user: { id: 'u1' } } as Session,
}
const signedOut: SessionState = { status: 'signedOut', session: null }
const loading: SessionState = { status: 'loading', session: null }

const memberDetail = (over: Partial<EventDetail> = {}): EventDetail => ({
  id: ID,
  teamId: TEAM_ID,
  teamName: 'Firsts',
  type: 'training',
  title: 'Evening session',
  location: 'Dalymount Park',
  notes: 'Bring both kits.',
  opponent: null,
  homeAway: null,
  jersey: null,
  meetAt: null,
  startsAt: '2026-09-15T00:07:26.597+00:00',
  status: 'scheduled',
  myResponse: null,
  ...over,
})

const previewRow: EventPreview = {
  team_id: TEAM_ID,
  team_name: 'Firsts',
  type: 'match',
  title: 'Firsts v Shelbourne',
  location: 'Tolka Park',
  starts_at: '2026-09-23T22:07:26.597+00:00',
  status: 'scheduled',
}

function renderAt(id: string, session: SessionState) {
  return render(
    <SessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[`/event/${id}`]}>
        <Routes>
          <Route path="/event/:id" element={<EventDetailScreen />} />
          <Route path="/register" element={<div>register screen</div>} />
          <Route path="/login" element={<div>login screen</div>} />
          <Route path="/" element={<div>home screen</div>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(() => {
  hoisted.detail.value = hoisted.settled<EventDetail>(null)
  hoisted.preview.value = hoisted.settled<EventPreview>(null)
  hoisted.join.mutate = vi.fn()
  hoisted.join.isPending = false
  hoisted.join.isError = false
  hoisted.join.error = null
  hoisted.setResponse.mutate = vi.fn()
  hoisted.setResponse.isError = false
  hoisted.setPendingJoin.mockReset()
  hoisted.setIntendedRoute.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('EventDetailScreen — member view', () => {
  it('shows team, badge, date, location and notes when notes are present (AC2)', () => {
    hoisted.detail.value = hoisted.settled(memberDetail())
    renderAt(ID, signedIn)
    expect(screen.getByText('Firsts')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument() // the type badge
    expect(screen.getByRole('heading', { name: 'Evening session' })).toBeInTheDocument()
    expect(screen.getByText('Dalymount Park')).toBeInTheDocument()
    expect(screen.getByText('Bring both kits.')).toBeInTheDocument()
    // The one date, through formatEventTime (Dublin, IST in September).
    expect(screen.getByText('Tuesday 15 September, 1.07am')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
  })

  it('renders no notes block when notes are null (AC2)', () => {
    hoisted.detail.value = hoisted.settled(memberDetail({ notes: null }))
    renderAt(ID, signedIn)
    expect(screen.queryByText('Bring both kits.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
  })

  it('shows the cancelled banner and disables the buttons, keeping the answer (AC14)', () => {
    hoisted.detail.value = hoisted.settled(
      memberDetail({ status: 'cancelled', myResponse: 'available' }),
    )
    renderAt(ID, signedIn)
    // The banner above the title carries the copy; the disabled-buttons line repeats it (D60).
    expect(screen.getByRole('status')).toHaveTextContent("This one's off.")
    expect(screen.getByRole('button', { name: 'Yes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled()
    expect(screen.getByText('You said yes.')).toBeInTheDocument()
  })
})

describe('EventDetailScreen — preview and 404', () => {
  it('shows the preview and a Join button, no availability buttons, for a signed-in non-member (AC9)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail>(null)
    hoisted.preview.value = hoisted.settled(previewRow)
    renderAt(ID, signedIn)
    expect(screen.getByRole('button', { name: 'Join Firsts' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Firsts v Shelbourne' })).toBeInTheDocument()
  })

  it('joins by event when a signed-in non-member taps Join (AC10)', async () => {
    hoisted.preview.value = hoisted.settled(previewRow)
    renderAt(ID, signedIn)
    await userEvent.click(screen.getByRole('button', { name: 'Join Firsts' }))
    expect(hoisted.join.mutate).toHaveBeenCalledWith(ID)
  })

  it('for an anonymous visitor, Join writes both stores then goes to register (AC11)', async () => {
    hoisted.preview.value = hoisted.settled(previewRow)
    renderAt(ID, signedOut)
    await userEvent.click(screen.getByRole('button', { name: 'Join Firsts' }))
    expect(hoisted.setPendingJoin).toHaveBeenCalledWith({ kind: 'event', eventId: ID })
    expect(hoisted.setIntendedRoute).toHaveBeenCalledWith(`/event/${ID}`)
    expect(await screen.findByText('register screen')).toBeInTheDocument()
  })

  it('for an anonymous visitor, the sign-in link writes both stores then goes to login (AC11)', async () => {
    hoisted.preview.value = hoisted.settled(previewRow)
    renderAt(ID, signedOut)
    await userEvent.click(screen.getByRole('button', { name: 'Already registered? Sign in' }))
    expect(hoisted.setPendingJoin).toHaveBeenCalledWith({ kind: 'event', eventId: ID })
    expect(hoisted.setIntendedRoute).toHaveBeenCalledWith(`/event/${ID}`)
    expect(await screen.findByText('login screen')).toBeInTheDocument()
  })

  it('replaces the join panel with the dead-link screen inline on invalid_invite (S2.4 AC12)', () => {
    hoisted.preview.value = hoisted.settled(previewRow)
    hoisted.join.isError = true
    hoisted.join.error = new AppError('invalid_invite')
    renderAt(ID, signedIn)
    // Event details stay above the inline dead-link screen.
    expect(screen.getByRole('heading', { name: 'Firsts v Shelbourne' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "That link's no good." })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Join Firsts' })).not.toBeInTheDocument()
  })

  it('keeps the enabled Join button and shows a retry line on a network failure (S2.4 AC12)', () => {
    hoisted.preview.value = hoisted.settled(previewRow)
    hoisted.join.isError = true
    hoisted.join.error = new AppError('unknown')
    renderAt(ID, signedIn)
    expect(screen.getByRole('button', { name: 'Join Firsts' })).toBeEnabled()
    expect(screen.getByText('Couldn’t join. Try again.')).toBeInTheDocument()
  })

  it('renders the not-found screen when both reads come back empty (AC13)', () => {
    hoisted.detail.value = hoisted.settled<EventDetail>(null)
    hoisted.preview.value = hoisted.settled<EventPreview>(null)
    renderAt(ID, signedIn)
    expect(screen.getByRole('heading', { name: "We can't find that event." })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the app' })).toBeInTheDocument()
  })

  it('renders the not-found screen for a malformed id (AC13)', () => {
    renderAt('not-a-uuid', signedIn)
    expect(screen.getByRole('heading', { name: "We can't find that event." })).toBeInTheDocument()
  })
})

describe('EventDetailScreen — loading and error (AC17)', () => {
  it('shows a skeleton while the session is restoring', () => {
    renderAt(ID, loading)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('shows an inline error with a Retry that refetches when a read fails', async () => {
    const refetch = vi.fn()
    hoisted.detail.value = { isError: true, isSuccess: false, data: null, refetch }
    renderAt(ID, signedIn)
    expect(screen.getByText("Couldn't load this event.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
