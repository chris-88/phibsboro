import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventRow } from '@/features/events/schema'

const mutate = vi.fn()
const hoisted = vi.hoisted(() => ({ isPending: { value: false } }))
vi.mock('@/api/events', () => ({
  useDeleteEvent: () => ({ mutate, isPending: hoisted.isPending.value }),
}))

const { DeleteEventDialog } = await import('@/features/events/components/DeleteEventDialog')

function eventRow(title: string): EventRow {
  return {
    id: '00000000-0000-4000-8000-000000000101',
    team_id: '00000000-0000-4000-8000-000000000001',
    type: 'match',
    title,
    location: 'Tolka Park',
    notes: null,
    opponent: null,
    home_away: null,
    meet_at: null,
    starts_at: '2026-03-14T19:30:00+00:00',
    status: 'scheduled',
    series_id: null,
    created_by: null,
    created_at: '2026-01-01T00:00:00+00:00',
    updated_at: '2026-01-01T00:00:00+00:00',
  }
}

const noop = (): void => undefined
const deleteButton = (): HTMLElement => screen.getByRole('button', { name: 'Delete' })

beforeEach(() => {
  mutate.mockClear()
  hoisted.isPending.value = false
})

describe('DeleteEventDialog — the typed confirmation (S4.2 AC10)', () => {
  it('states the cascade consequence', () => {
    render(<DeleteEventDialog event={eventRow('Cup final')} open onOpenChange={noop} />)
    expect(
      screen.getByText(
        'This deletes the event and every response and attendance record for it. It cannot be undone.',
      ),
    ).toBeInTheDocument()
  })

  it('Delete stays disabled until the title matches exactly, whitespace and all', async () => {
    render(<DeleteEventDialog event={eventRow('Cup final')} open onOpenChange={noop} />)
    const input = screen.getByLabelText('Type the title to confirm')

    expect(deleteButton()).toBeDisabled()

    await userEvent.type(input, 'cup final')
    expect(deleteButton()).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, 'Cup final ')
    expect(deleteButton()).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, 'Cup final')
    expect(deleteButton()).toBeEnabled()
  })

  it('confirming an exact match fires the delete once', async () => {
    render(<DeleteEventDialog event={eventRow('Cup final')} open onOpenChange={noop} />)
    await userEvent.type(screen.getByLabelText('Type the title to confirm'), 'Cup final')
    await userEvent.click(deleteButton())
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]?.[0]).toEqual({ id: '00000000-0000-4000-8000-000000000101' })
  })
})
