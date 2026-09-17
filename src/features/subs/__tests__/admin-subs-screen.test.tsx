import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUser } from '@/api/admin-users'
import type { ClubSettings } from '@/api/subs'
import type { SubsPaymentRow } from '@/features/subs/schema'

const hoisted = vi.hoisted(() => ({
  settings: {
    value: {
      data: undefined as ClubSettings | undefined,
      isError: false,
      refetch: () => undefined,
    },
  },
  users: {
    value: { data: undefined as AdminUser[] | undefined, isError: false, refetch: () => undefined },
  },
  payments: {
    value: {
      data: undefined as SubsPaymentRow[] | undefined,
      isError: false,
      refetch: () => undefined,
    },
  },
  updateMut: vi.fn(),
  recordMut: vi.fn(),
  deleteMut: vi.fn(),
  isAdmin: { value: true },
}))

vi.mock('@/api/subs', () => ({
  useClubSettings: () => hoisted.settings.value,
  useSubsPayments: () => hoisted.payments.value,
  useUpdateClubSettings: () => ({ mutate: hoisted.updateMut, isPending: false, isError: false }),
  useRecordSubsPayment: () => ({ mutate: hoisted.recordMut, isPending: false }),
  useDeleteSubsPayment: () => ({ mutate: hoisted.deleteMut, isPending: false }),
}))
vi.mock('@/api/admin-users', () => ({ useAllUsers: () => hoisted.users.value }))
vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () =>
    hoisted.isAdmin.value
      ? { status: 'ready', user: { id: 'me', isAdmin: true } }
      : { status: 'ready', user: { id: 'me', isAdmin: false } },
}))

const AdminSubsScreen = (await import('@/features/subs/routes/AdminSubsScreen')).default

const member = (id: string, name: string): AdminUser => ({
  id,
  name,
  phone: `+3538${id}`,
  isAdmin: false,
  lastSignInAt: null,
  lastSeenAt: null,
  memberships: [{ teamId: 't1', teamName: 'PCF I', role: 'player' }],
})
const payment = (userId: string, amount: number): SubsPaymentRow => ({
  id: `p-${userId}-${String(amount)}`,
  user_id: userId,
  amount,
  note: null,
  recorded_by: 'me',
  recorded_at: '2026-09-16T10:00:00+00:00',
})

function renderScreen(): void {
  render(
    <MemoryRouter initialEntries={['/admin/subs']}>
      <AdminSubsScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hoisted.isAdmin.value = true
  hoisted.settings.value = {
    data: { amount: 100, payLink: 'https://pay.example' },
    isError: false,
    refetch: () => undefined,
  }
  hoisted.users.value = {
    data: [member('a', 'Aaron'), member('b', 'Ben')],
    isError: false,
    refetch: () => undefined,
  }
  hoisted.payments.value = {
    data: [payment('a', 40), payment('b', 100)],
    isError: false,
    refetch: () => undefined,
  }
  hoisted.updateMut.mockReset()
  hoisted.recordMut.mockReset()
})

describe('AdminSubsScreen (Epic 19)', () => {
  it('redirects a non-admin away', () => {
    hoisted.isAdmin.value = false
    renderScreen()
    expect(screen.queryByText('Subs settings')).not.toBeInTheDocument()
  })

  it('seeds the settings form and saves the amount + link', async () => {
    renderScreen()
    const amount = screen.getByLabelText('Amount everyone owes (€)')
    expect(amount).toHaveValue(100)
    await userEvent.clear(amount)
    await userEvent.type(amount, '120')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(hoisted.updateMut.mock.calls[0]?.[0]).toEqual({
      amount: 120,
      payLink: 'https://pay.example',
    })
  })

  it('shows each member with paid / outstanding and a summary', () => {
    renderScreen()
    // Aaron owes 60, Ben is paid up.
    expect(screen.getByText('Aaron')).toBeInTheDocument()
    expect(screen.getByText('€60.00 left')).toBeInTheDocument()
    // "Paid up" is both Ben's badge and the summary label.
    expect(screen.getAllByText('Paid up').length).toBeGreaterThan(0)
    // Summary: collected 140, outstanding 60.
    expect(screen.getByText('€140.00')).toBeInTheDocument()
    expect(screen.getByText('€60.00')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('records a part-payment from a member’s dialog', async () => {
    // One member here, so a single Payments button to open.
    hoisted.users.value = {
      data: [member('a', 'Aaron')],
      isError: false,
      refetch: () => undefined,
    }
    hoisted.payments.value = {
      data: [payment('a', 40)],
      isError: false,
      refetch: () => undefined,
    }
    renderScreen()
    await userEvent.click(screen.getByRole('button', { name: 'Payments' }))
    await userEvent.type(screen.getByLabelText('Record a payment (€)'), '20')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(hoisted.recordMut.mock.calls[0]?.[0]).toEqual({ userId: 'a', amount: 20 })
  })
})
