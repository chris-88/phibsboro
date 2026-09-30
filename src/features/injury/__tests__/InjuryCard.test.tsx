import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerInjuryRow } from '@/features/injury/schema'

const hoisted = vi.hoisted(() => ({
  injury: { value: null as unknown as { data: PlayerInjuryRow | null | undefined } },
  setInjury: { fn: vi.fn() },
  clearInjury: { fn: vi.fn() },
}))

vi.mock('@/api/injuries', () => ({
  useMyInjury: () => hoisted.injury.value,
  useSetInjury: () => ({ mutate: hoisted.setInjury.fn, isPending: false }),
  useClearInjury: () => ({ mutate: hoisted.clearInjury.fn, isPending: false }),
}))
vi.mock('@/features/auth/use-current-user', () => ({ useSignedInUser: () => ({ id: 'u1' }) }))

const { InjuryCard } = await import('@/features/injury/InjuryCard')

const injuryRow = (over: Partial<PlayerInjuryRow> = {}): PlayerInjuryRow => ({
  user_id: 'u1',
  expected_return: '2026-10-14',
  note: 'hamstring',
  updated_by: null,
  updated_at: '2026-09-30T00:00:00Z',
  ...over,
})

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  hoisted.setInjury.fn.mockReset()
  hoisted.clearInjury.fn.mockReset()
})

describe('InjuryCard (S20.3)', () => {
  it('renders nothing while the read is loading', () => {
    hoisted.injury.value = { data: undefined }
    const { container } = render(<InjuryCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers "Mark yourself injured" when fit and saves', async () => {
    hoisted.injury.value = { data: null }
    render(<InjuryCard />)
    expect(screen.queryByText('Injured')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mark yourself injured' }))
    await userEvent.type(await screen.findByRole('textbox', { name: /Note/ }), 'calf')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(hoisted.setInjury.fn).toHaveBeenCalledOnce()
    expect(hoisted.setInjury.fn.mock.calls[0]?.[0]).toMatchObject({
      userId: 'u1',
      expectedReturn: null,
      note: 'calf',
    })
  })

  it('shows the status and expected return when injured, and can mark fit', async () => {
    hoisted.injury.value = { data: injuryRow() }
    render(<InjuryCard />)
    expect(screen.getByText('Injured')).toBeInTheDocument()
    expect(screen.getByText(/Expected back Wed 14 Oct/)).toBeInTheDocument()
    expect(screen.getByText('hamstring')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Update' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as fit' }))
    expect(hoisted.clearInjury.fn).toHaveBeenCalledOnce()
    expect(hoisted.clearInjury.fn.mock.calls[0]?.[0]).toMatchObject({ userId: 'u1' })
  })
})
