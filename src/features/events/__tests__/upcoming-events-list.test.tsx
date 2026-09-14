import type { UseQueryResult } from '@tanstack/react-query'
import type { PostgrestError } from '@supabase/supabase-js'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { UpcomingEvent } from '@/api/events'
import { UpcomingEventsList } from '@/features/events/components/UpcomingEventsList'

type Query = UseQueryResult<UpcomingEvent[], PostgrestError>

const upcoming = (over: Partial<UpcomingEvent> = {}): UpcomingEvent => ({
  id: '00000000-0000-4000-8000-000000000101',
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

// Only the four fields the component reads; cast to the full query type for the prop.
const settled = (data: UpcomingEvent[]): Query =>
  ({ data, isPending: false, isError: false }) as unknown as Query
const pending = (): Query =>
  ({ data: undefined, isPending: true, isError: false }) as unknown as Query
const errored = (): Query =>
  ({ data: undefined, isPending: false, isError: true }) as unknown as Query

function renderList(query: Query, excludeEventId: string | null, showTeamName = false): void {
  render(
    <MemoryRouter>
      <UpcomingEventsList
        query={query}
        excludeEventId={excludeEventId}
        showTeamName={showTeamName}
      />
    </MemoryRouter>,
  )
}

describe('UpcomingEventsList (S3.2)', () => {
  it('excludes the card event so no fixture shows twice (AC1)', () => {
    const shown = upcoming({ id: 'shown', title: 'Away at Bohs' })
    renderList(settled([upcoming({ id: 'card', title: 'In the card' }), shown]), 'card')
    expect(screen.getByText('Away at Bohs')).toBeInTheDocument()
    expect(screen.queryByText('In the card')).not.toBeInTheDocument()
  })

  it('preserves the query order and does not re-sort (AC2)', () => {
    renderList(
      settled([
        upcoming({ id: 'a', title: 'First up' }),
        upcoming({ id: 'b', title: 'Second up' }),
        upcoming({ id: 'c', title: 'Third up' }),
      ]),
      null,
    )
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => within(li).getByText(/up$/).textContent)).toEqual([
      'First up',
      'Second up',
      'Third up',
    ])
  })

  it('shows a cancelled row marked, struck, with its status pill still present (AC6)', () => {
    renderList(
      settled([
        upcoming({ id: 'x', title: 'Called off', status: 'cancelled', myResponse: 'available' }),
      ]),
      null,
    )
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    const title = screen.getByText('Called off')
    expect(title.className).toContain('line-through')
    // The pre-cancellation answer is still shown, not hidden.
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('renders each of the three status words (AC5)', () => {
    renderList(
      settled([
        upcoming({ id: 'a', title: 'Yes one', myResponse: 'available' }),
        upcoming({ id: 'b', title: 'No one', myResponse: 'unavailable' }),
        upcoming({ id: 'c', title: 'Waiting one', myResponse: null }),
      ]),
      null,
    )
    expect(screen.getByText('Available')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
    expect(screen.getByText('Awaiting')).toBeInTheDocument()
  })

  it('shows the team name on rows with more than one membership (AC7)', () => {
    renderList(settled([upcoming()]), null, true)
    expect(screen.getByText('· Firsts')).toBeInTheDocument()
  })

  it('omits the team name with exactly one membership (AC7)', () => {
    renderList(settled([upcoming()]), null, false)
    expect(screen.queryByText('· Firsts')).not.toBeInTheDocument()
  })

  it('shows "Nothing else coming up." when the only event is the excluded one (AC10)', () => {
    renderList(settled([upcoming({ id: 'card' })]), 'card')
    expect(screen.getByText('Nothing else coming up.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders nothing when there are no events and no card (AC11)', () => {
    const { container } = render(
      <MemoryRouter>
        <UpcomingEventsList query={settled([])} excludeEventId={null} showTeamName={false} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing on error — S3.1 owns the failure (AC13)', () => {
    const { container } = render(
      <MemoryRouter>
        <UpcomingEventsList query={errored()} excludeEventId={null} showTeamName={false} />
      </MemoryRouter>,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows three skeleton rows while pending (AC12)', () => {
    renderList(pending(), null)
    const region = screen.getByRole('status', { name: 'Loading events' })
    expect(within(region).getAllByRole('listitem')).toHaveLength(3)
  })

  it('heads the populated branch with "Also coming up" (AC5, AC11)', () => {
    renderList(settled([upcoming()]), null)
    expect(screen.getByRole('heading', { name: 'Also coming up' })).toBeInTheDocument()
  })

  it('links each row to /event/{id} with the untruncated title in the accessible name (AC8, AC9)', () => {
    const longTitle = 'Phibsboro First Team versus Kilbarrack United on a wet Saturday'
    renderList(settled([upcoming({ id: 'evt-9', title: longTitle })]), null)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/event/evt-9')
    expect(link).toHaveAccessibleName(new RegExp(longTitle))
  })
})
