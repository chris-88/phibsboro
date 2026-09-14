import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { HistoryRow } from '@/features/attendance/components/HistoryRow'
import type { HistoryRow as HistoryRowData } from '@/features/attendance/schema'

const row = (over: Partial<HistoryRowData> = {}): HistoryRowData => ({
  id: '00000000-0000-4000-8000-000000000101',
  team_id: '00000000-0000-4000-8000-000000000001',
  type: 'training',
  title: 'Tuesday session',
  // TZ=UTC is pinned; formatEventTime renders Europe/Dublin (IST, +1 in September).
  starts_at: '2026-09-08T18:30:00.000Z',
  status: 'scheduled',
  attendance: 'attended',
  ...over,
})

function renderRow(data: HistoryRowData): HTMLElement {
  render(
    <MemoryRouter>
      <ul>
        <HistoryRow row={data} />
      </ul>
    </MemoryRouter>,
  )
  return screen.getByRole('link')
}

describe('HistoryRow (S3.5)', () => {
  it('links the whole row to the event detail screen (AC11)', () => {
    const link = renderRow(row())
    expect(link).toHaveAttribute('href', '/event/00000000-0000-4000-8000-000000000101')
  })

  it('shows the title, the type badge and the Dublin date (AC10)', () => {
    renderRow(row())
    const link = screen.getByRole('link')
    expect(within(link).getByText('Tuesday session')).toBeInTheDocument()
    expect(within(link).getByText('Training')).toBeInTheDocument()
    // 18:30 UTC in September is 19:30 IST → "7.30pm".
    expect(within(link).getByText('Tue 8 Sep, 7.30pm')).toBeInTheDocument()
  })

  it('renders exactly one attendance pill and it carries the state word (AC3)', () => {
    renderRow(row({ attendance: 'absent' }))
    expect(screen.getByText('Absent')).toBeInTheDocument()
    expect(screen.queryByText('Attended')).not.toBeInTheDocument()
  })

  it('marks a cancelled event Cancelled with no attendance pill (AC4)', () => {
    renderRow(row({ status: 'cancelled', attendance: 'not-recorded' }))
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByText('Not recorded')).not.toBeInTheDocument()
  })

  it('carries the full title, date and state in the accessible name', () => {
    const link = renderRow(row({ attendance: 'attended' }))
    expect(link).toHaveAttribute('aria-label', 'Tuesday session, Tue 8 Sep, 7.30pm, Attended')
  })

  it('renders no control that writes (AC5)', () => {
    renderRow(row())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
