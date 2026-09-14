import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EventActionData } from '@/features/events/schema'

// serverNow is fixed so the past/future gate (AC8) is deterministic; useCurrentUser is stubbed so
// the role gate (AC9) can be driven from each test. Both are mocked before the component imports.
const hoisted = vi.hoisted(() => ({
  isManagerOf: vi.fn<(teamId: string) => boolean>(() => true),
  status: 'ready',
}))

vi.mock('@/lib/serverClock', () => ({ serverNow: () => new Date('2026-09-10T00:00:00Z') }))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () =>
    hoisted.status === 'ready'
      ? { status: 'ready', user: { isAdmin: false, isManagerOf: hoisted.isManagerOf } }
      : { status: 'signedOut' },
}))

const { EventShareControl } = await import('@/features/events/components/EventShareControl')

const TEAM = '00000000-0000-4000-8000-000000000001'
const base: EventActionData = {
  id: '00000000-0000-4000-8000-000000000102',
  team_id: TEAM,
  type: 'training',
  title: 'Training',
  location: 'Dalymount Park',
  notes: null,
  opponent: null,
  home_away: null,
  meet_at: null,
  starts_at: '2026-09-15T18:30:00+00:00', // future relative to the fixed serverNow
  status: 'scheduled',
}

afterEach(() => {
  hoisted.status = 'ready'
  hoisted.isManagerOf.mockReturnValue(true)
  vi.clearAllMocks()
})

describe('EventShareControl', () => {
  it('renders the share control for a manager of a future scheduled event (AC1, AC9)', () => {
    render(<EventShareControl event={base} />)
    expect(screen.getByRole('link', { name: 'Share to WhatsApp' })).toBeInTheDocument()
  })

  it('renders nothing for a player (AC9)', () => {
    hoisted.isManagerOf.mockReturnValue(false)
    render(<EventShareControl event={base} />)
    expect(screen.queryByRole('link', { name: 'Share to WhatsApp' })).not.toBeInTheDocument()
  })

  it('renders nothing for a cancelled event (AC8)', () => {
    render(<EventShareControl event={{ ...base, status: 'cancelled' }} />)
    expect(screen.queryByRole('link', { name: 'Share to WhatsApp' })).not.toBeInTheDocument()
  })

  it('renders nothing once starts_at has passed, judged by serverNow (AC8)', () => {
    render(<EventShareControl event={{ ...base, starts_at: '2026-09-01T18:30:00+00:00' }} />)
    expect(screen.queryByRole('link', { name: 'Share to WhatsApp' })).not.toBeInTheDocument()
  })

  it('passes the built message to the control, link intact past the hash (AC2, AC3)', () => {
    render(<EventShareControl event={base} />)
    const href = screen.getByRole('link', { name: 'Share to WhatsApp' }).getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(href).toContain('%23%2Fevent%2F') // the hash route survived encoding
    const body = decodeURIComponent(href.slice('https://wa.me/?text='.length))
    expect(body).toContain('🏃 Training')
    expect(body).toContain('Are you available?')
  })
})
