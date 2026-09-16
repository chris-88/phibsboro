import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import type { AttendanceStatRow, PerformanceStatRow } from '@/features/stats/schema'
import type { CurrentUser } from '@/features/auth/use-current-user'

const hoisted = vi.hoisted(() => ({
  att: { value: undefined as unknown as UseQueryResult<AttendanceStatRow[]> },
  perf: { value: undefined as unknown as UseQueryResult<PerformanceStatRow[]> },
  user: {
    value: {
      isAdmin: false,
      memberships: [{ teamId: 't1', teamName: 'PCF I', role: 'player', joinedAt: '2026-01-01' }],
      administrableTeams: [],
    } as unknown as CurrentUser,
  },
}))

vi.mock('@/api/stats', () => ({
  useAttendanceStats: () => hoisted.att.value,
  usePerformanceStats: () => hoisted.perf.value,
}))
vi.mock('@/features/auth/use-current-user', () => ({ useSignedInUser: () => hoisted.user.value }))

const StatsScreen = (await import('@/features/stats/routes/StatsScreen')).default

const q = <T,>(over: Partial<UseQueryResult<T>>): UseQueryResult<T> =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    isSuccess: false,
    refetch: vi.fn(),
    ...over,
  }) as unknown as UseQueryResult<T>

const attRow = (over: Partial<AttendanceStatRow> = {}): AttendanceStatRow => ({
  user_id: 'u1',
  name: 'Aaron Byrne',
  games_total: 4,
  games_attended: 3,
  training_total: 10,
  training_attended: 8,
  responded: 12,
  invited: 14,
  ...over,
})
const perfRow = (over: Partial<PerformanceStatRow> = {}): PerformanceStatRow => ({
  user_id: 'u1',
  name: 'Aaron Byrne',
  appearances: 4,
  goals: 5,
  assists: 2,
  yellow_cards: 1,
  red_cards: 0,
  minutes: 320,
  motm: 1,
  ...over,
})

function renderStats(): void {
  hoisted.att.value = q<AttendanceStatRow[]>({ isSuccess: true, data: [attRow()] })
  hoisted.perf.value = q<PerformanceStatRow[]>({ isSuccess: true, data: [perfRow()] })
  render(<StatsScreen />)
}

describe('StatsScreen (S17.7)', () => {
  it('shows Attendance by default with the figures', () => {
    renderStats()
    expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument()
    expect(screen.getByText('Aaron Byrne')).toBeInTheDocument()
    // (3+8)/(4+10) = 79%
    expect(screen.getByText('79%')).toBeInTheDocument()
  })

  it('switches to Performance and shows goals/assists', async () => {
    renderStats()
    await userEvent.click(screen.getByRole('radio', { name: 'Performance' }))
    expect(screen.getByText('5 G · 2 A')).toBeInTheDocument()
  })

  it('shows the loading and empty states', () => {
    hoisted.att.value = q<AttendanceStatRow[]>({ isPending: true })
    hoisted.perf.value = q<PerformanceStatRow[]>({ data: [] })
    render(<StatsScreen />)
    expect(screen.getByLabelText('Loading attendance')).toBeInTheDocument()
  })

  it('shows the no-teams empty when the viewer is on no team', () => {
    hoisted.user.value = {
      isAdmin: false,
      memberships: [],
      administrableTeams: [],
    } as unknown as CurrentUser
    hoisted.att.value = q<AttendanceStatRow[]>({ data: [] })
    hoisted.perf.value = q<PerformanceStatRow[]>({ data: [] })
    render(<StatsScreen />)
    expect(screen.getByText('No teams yet.')).toBeInTheDocument()
  })
})
