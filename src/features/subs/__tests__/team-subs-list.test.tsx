import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ClubSettings } from '@/api/subs'
import type { SubsPaymentRow } from '@/features/subs/schema'
import type { MemberDirectoryRow } from '@/features/teams/schema'

const hoisted = vi.hoisted(() => ({
  members: { value: undefined as unknown as UseQueryResult<MemberDirectoryRow[]> },
  payments: { value: undefined as unknown as UseQueryResult<SubsPaymentRow[]> },
  settings: { value: undefined as unknown as UseQueryResult<ClubSettings> },
}))
vi.mock('@/api/members', () => ({ useTeamMembers: () => hoisted.members.value }))
vi.mock('@/api/subs', () => ({
  useSubsPayments: () => hoisted.payments.value,
  useClubSettings: () => hoisted.settings.value,
}))

const { TeamSubsList } = await import('@/features/subs/components/TeamSubsList')

const q = <T,>(over: Partial<UseQueryResult<T>>): UseQueryResult<T> =>
  ({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  }) as UseQueryResult<T>

const member = (id: string, name: string): MemberDirectoryRow => ({
  user_id: id,
  name,
  role: 'player',
  joined_at: '2026-01-01T00:00:00+00:00',
  phone: null,
})
const payment = (userId: string, amount: number): SubsPaymentRow => ({
  id: `p-${userId}`,
  user_id: userId,
  amount,
  note: null,
  recorded_by: 'x',
  recorded_at: '2026-09-16T10:00:00+00:00',
})

beforeEach(() => {
  hoisted.members.value = q<MemberDirectoryRow[]>({
    data: [member('a', 'Aaron'), member('b', 'Ben')],
    isPending: false,
  })
  hoisted.payments.value = q<SubsPaymentRow[]>({ data: [payment('b', 100)], isPending: false })
  hoisted.settings.value = q<ClubSettings>({
    data: { amount: 100, payLink: 'https://pay.example' },
    isPending: false,
  })
})

describe('TeamSubsList (S19.4)', () => {
  it('shows each member paid/behind, most-owing first, with a Remind for the unpaid', () => {
    render(<TeamSubsList teamId="t1" />)
    // Aaron owes 100 with a WhatsApp remind; Ben is paid up with none.
    expect(screen.getByText('€100.00 left')).toBeInTheDocument()
    expect(screen.getByText('Paid up')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /remind aaron/i })).toHaveAttribute(
      'href',
      expect.stringContaining('wa.me'),
    )
    expect(screen.queryByRole('link', { name: /remind ben/i })).not.toBeInTheDocument()
    // Most-owing first: Aaron before Ben.
    const order = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(order[0]).toContain('Aaron')
    expect(order[1]).toContain('Ben')
  })

  it('shows an empty state when subs are not set up', () => {
    hoisted.settings.value = q<ClubSettings>({
      data: { amount: 0, payLink: null },
      isPending: false,
    })
    render(<TeamSubsList teamId="t1" />)
    expect(screen.getByText("Subs aren't set up yet.")).toBeInTheDocument()
  })

  it('shows an error state with retry when a read fails', () => {
    hoisted.payments.value = q<SubsPaymentRow[]>({ isError: true })
    render(<TeamSubsList teamId="t1" />)
    expect(screen.getByText("Couldn't load subs.")).toBeInTheDocument()
  })
})
