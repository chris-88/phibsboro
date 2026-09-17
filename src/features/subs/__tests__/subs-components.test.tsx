import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MySubs } from '@/api/subs'

const hoisted = vi.hoisted(() => ({
  mySubs: {
    value: { data: undefined as MySubs | undefined, isPending: false, isError: false },
  },
}))
vi.mock('@/api/subs', () => ({ useMySubs: () => hoisted.mySubs.value }))

const { SubsCard } = await import('@/features/subs/components/SubsCard')
const { SubsReminderModal } = await import('@/features/subs/components/SubsReminderModal')

const set = (over: Partial<MySubs> | undefined): void => {
  hoisted.mySubs.value = {
    data:
      over === undefined
        ? undefined
        : { amountDue: 100, paid: 0, outstanding: 100, payLink: 'https://pay.example', ...over },
    isPending: false,
    isError: false,
  }
}

beforeEach(() => {
  try {
    sessionStorage.clear()
  } catch {
    /* jsdom */
  }
  set({})
})

describe('SubsCard (S19.2)', () => {
  it('shows the outstanding balance and a Pay link when owing', () => {
    set({ amountDue: 100, paid: 40, outstanding: 60 })
    render(<SubsCard />)
    expect(screen.getByText('€60.00')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pay now' })).toHaveAttribute(
      'href',
      'https://pay.example',
    )
  })

  it('reads paid up when the balance is clear', () => {
    set({ amountDue: 100, paid: 100, outstanding: 0 })
    render(<SubsCard />)
    expect(screen.getByText(/paid up/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pay now' })).not.toBeInTheDocument()
  })

  it('renders nothing when subs are not set up (amount 0)', () => {
    set({ amountDue: 0, paid: 0, outstanding: 0 })
    const { container } = render(<SubsCard />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('SubsReminderModal (S19.3)', () => {
  it('appears when the member owes, with Pay now and Later', () => {
    set({ outstanding: 45 })
    render(<SubsReminderModal />)
    expect(screen.getByText('Subs due')).toBeInTheDocument()
    expect(screen.getByText('You owe €45.00 in subs.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pay now' })).toBeInTheDocument()
  })

  it('does not appear when paid up', () => {
    set({ outstanding: 0 })
    render(<SubsReminderModal />)
    expect(screen.queryByText('Subs due')).not.toBeInTheDocument()
  })

  it('dismisses for the session on Later', async () => {
    set({ outstanding: 45 })
    render(<SubsReminderModal />)
    await userEvent.click(screen.getByRole('button', { name: 'Later' }))
    expect(screen.queryByText('Subs due')).not.toBeInTheDocument()
    // A fresh mount in the same session stays dismissed.
    render(<SubsReminderModal />)
    expect(screen.queryByText('Subs due')).not.toBeInTheDocument()
  })
})
