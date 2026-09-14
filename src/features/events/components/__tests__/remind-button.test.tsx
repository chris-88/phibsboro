import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventActionData } from '@/features/events/schema'
import type { Counts } from '@/lib/counts'

// serverNow is fixed so the past/future gate is deterministic. RemindButton reads no user or
// query — its own gates are status, the clock and the awaiting count — so nothing else is stubbed.
vi.mock('@/lib/serverClock', () => ({ serverNow: () => new Date('2026-09-10T00:00:00Z') }))

const { RemindButton } = await import('@/features/events/components/RemindButton')

const base: EventActionData = {
  id: '00000000-0000-4000-8000-000000000102',
  team_id: '00000000-0000-4000-8000-000000000001',
  type: 'training',
  title: 'Training',
  location: 'Dalymount Park',
  notes: null,
  starts_at: '2026-09-15T18:30:00+00:00', // future relative to the fixed serverNow
  status: 'scheduled',
}

const counts = (awaiting: number): Counts => ({
  available: 0,
  unavailable: 0,
  awaiting,
  squad: awaiting,
})

const link = (): HTMLElement | null => screen.queryByRole('link', { name: 'Send a reminder' })

describe('RemindButton (S5.3)', () => {
  it('renders the reminder control for a scheduled future event with outstanding responses (AC7)', () => {
    render(<RemindButton event={base} counts={counts(8)} />)
    const el = link()
    expect(el).toBeInTheDocument()
    // The count lives in the message, not the button label (AC7); the awaiting figure rides in
    // the shared href (AC4, AC8).
    const href = el?.getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    const body = decodeURIComponent(href.slice('https://wa.me/?text='.length))
    expect(body).toContain('8 still to answer. Yes or no:')
    expect(body).toContain('🏃 Training')
  })

  it('renders nothing for a cancelled event (AC6)', () => {
    render(<RemindButton event={{ ...base, status: 'cancelled' }} counts={counts(8)} />)
    expect(link()).not.toBeInTheDocument()
  })

  it('renders nothing once starts_at has passed, judged by serverNow (AC6)', () => {
    render(
      <RemindButton
        event={{ ...base, starts_at: '2026-09-01T18:30:00+00:00' }}
        counts={counts(8)}
      />,
    )
    expect(link()).not.toBeInTheDocument()
  })

  it('renders nothing when nobody is awaiting (AC5, AC6)', () => {
    render(<RemindButton event={base} counts={counts(0)} />)
    expect(link()).not.toBeInTheDocument()
  })

  it('renders nothing while the counts are still unknown (AC5)', () => {
    render(<RemindButton event={base} counts={undefined} />)
    expect(link()).not.toBeInTheDocument()
  })

  it('carries the current count, so a later render sends the new number (AC9)', () => {
    const { rerender } = render(<RemindButton event={base} counts={counts(8)} />)
    rerender(<RemindButton event={base} counts={counts(7)} />)
    const body = decodeURIComponent(
      (link()?.getAttribute('href') ?? '').slice('https://wa.me/?text='.length),
    )
    expect(body).toContain('7 still to answer.')
    expect(body).not.toContain('8 still to answer.')
  })
})
