import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { AttendanceHistory, HistoryList } from '@/api/attendance'
import type { CurrentUser } from '@/features/auth/use-current-user'
import type {
  AdminHistoryRow as AdminHistoryRowData,
  HistoryRow as HistoryRowData,
} from '@/features/attendance/schema'

const hoisted = vi.hoisted(() => ({
  history: { value: undefined as unknown as AttendanceHistory },
  admin: {
    value: {
      rows: [] as unknown[],
      status: 'success',
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    } as unknown as HistoryList<AdminHistoryRowData>,
  },
  isAdmin: { value: false },
}))

vi.mock('@/api/attendance', () => ({
  useAttendanceHistory: () => hoisted.history.value,
  useAdminAttendanceHistory: () => hoisted.admin.value,
}))
vi.mock('@/api/teams', () => ({
  useTeams: () => ({ data: [{ id: 'team-1', name: 'Firsts' }] }),
}))
vi.mock('@/features/auth/use-current-user', () => ({
  useSignedInUser: (): Pick<CurrentUser, 'id' | 'isAdmin'> => ({
    id: 'user-1',
    isAdmin: hoisted.isAdmin.value,
  }),
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
  hoisted.isAdmin.value = false
  hoisted.history.value = history
  render(
    <MemoryRouter>
      <HistoryScreen />
    </MemoryRouter>,
  )
}

const adminBase: HistoryList<AdminHistoryRowData> = {
  rows: [],
  status: 'success',
  hasNextPage: false,
  isFetchingNextPage: false,
  isFetchNextPageError: false,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}

const adminRow = (over: Partial<AdminHistoryRowData> = {}): AdminHistoryRowData => ({
  id: '00000000-0000-4000-8000-000000000101',
  team_id: 'team-1',
  type: 'match',
  title: 'v Larkview',
  starts_at: '2026-09-08T13:30:00.000Z',
  status: 'scheduled',
  attendedCount: 14,
  ...over,
})

function renderAdmin(admin: HistoryList<AdminHistoryRowData>): void {
  hoisted.isAdmin.value = true
  hoisted.admin.value = admin
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

describe('HistoryScreen admin god mode (S11.3)', () => {
  it("lists every team's past events, each linking to the manager record with an attended count", () => {
    renderAdmin({ ...adminBase, rows: [adminRow()] })
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toContain('/manage/event/')
    expect(link).toHaveTextContent('14 attended')
    // The team name is shown so an admin can tell the teams apart.
    expect(link).toHaveTextContent('Firsts')
  })

  it('shows a cancelled past event as Cancelled, not an attendance count', () => {
    renderAdmin({ ...adminBase, rows: [adminRow({ status: 'cancelled' })] })
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.queryByText(/attended/)).not.toBeInTheDocument()
  })
})
