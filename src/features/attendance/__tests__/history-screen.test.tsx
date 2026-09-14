import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { AttendanceHistory } from '@/api/attendance'
import type { CurrentUser } from '@/features/auth/use-current-user'
import type { HistoryRow as HistoryRowData } from '@/features/attendance/schema'

const hoisted = vi.hoisted(() => ({
  history: { value: undefined as unknown as AttendanceHistory },
}))

vi.mock('@/api/attendance', () => ({ useAttendanceHistory: () => hoisted.history.value }))
vi.mock('@/features/auth/use-current-user', () => ({
  useSignedInUser: (): Pick<CurrentUser, 'id'> => ({ id: 'user-1' }),
}))

const HistoryScreen = (await import('@/features/attendance/routes/HistoryScreen')).default

const base: AttendanceHistory = {
  rows: [],
  status: 'success',
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}

const row = (over: Partial<HistoryRowData> = {}): HistoryRowData => ({
  id: '00000000-0000-4000-8000-000000000101',
  team_id: '00000000-0000-4000-8000-000000000001',
  type: 'training',
  title: 'Tuesday session',
  starts_at: '2026-09-08T18:30:00.000Z',
  status: 'scheduled',
  attendance: 'attended',
  ...over,
})

function renderScreen(history: AttendanceHistory): void {
  hoisted.history.value = history
  render(
    <MemoryRouter>
      <HistoryScreen />
    </MemoryRouter>,
  )
}

describe('HistoryScreen (S3.5)', () => {
  it('shows the loading skeleton while pending', () => {
    renderScreen({ ...base, status: 'pending' })
    expect(screen.getByLabelText('Loading history')).toBeInTheDocument()
  })

  it('shows an inline retry on error, wired to refetch', async () => {
    const refetch = vi.fn()
    renderScreen({ ...base, status: 'error', refetch })
    expect(screen.getByText("Couldn't load your history.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('shows "No past events yet." when the filtered list is empty (D49)', () => {
    renderScreen({ ...base, status: 'success', rows: [] })
    expect(screen.getByText('No past events yet.')).toBeInTheDocument()
  })

  it('lists the rows newest first, one per past event', () => {
    renderScreen({
      ...base,
      rows: [row({ id: 'a', title: 'Newer' }), row({ id: 'b', title: 'Older' })],
    })
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent('Newer')
    expect(links[1]).toHaveTextContent('Older')
  })

  it('offers "Show more" while a full page remains and fetches the next on tap (AC9)', async () => {
    const fetchNextPage = vi.fn()
    renderScreen({ ...base, rows: [row()], hasNextPage: true, fetchNextPage })
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
    expect(fetchNextPage).toHaveBeenCalledOnce()
  })

  it('hides "Show more" when no further page remains', () => {
    renderScreen({ ...base, rows: [row()], hasNextPage: false })
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('keeps the rows and offers a retry when a later page fails', () => {
    renderScreen({ ...base, rows: [row()], hasNextPage: true, isFetchNextPageError: true })
    expect(screen.getByRole('link')).toBeInTheDocument()
    expect(screen.getByText("Couldn't load more.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    // The whole-screen error copy never appears while rows are on screen.
    expect(screen.queryByText("Couldn't load your history.")).not.toBeInTheDocument()
  })
})
