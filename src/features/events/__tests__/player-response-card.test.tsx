import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayerResponseCard } from '@/features/events/components/PlayerResponseCard'
import type { RosterRow } from '@/lib/roster'

const row = (over: Partial<RosterRow> = {}): RosterRow => ({
  userId: 'u1',
  name: 'Dara Byrne',
  role: 'player',
  response: null,
  attended: null,
  ...over,
})

describe('PlayerResponseCard', () => {
  it('shows the name and an availability pill labelled with name and state (AC2)', () => {
    render(<PlayerResponseCard row={row({ response: null })} />)
    expect(screen.getByText('Dara Byrne')).toBeInTheDocument()
    expect(screen.getByLabelText('Dara Byrne, awaiting')).toBeInTheDocument()
    expect(
      within(screen.getByLabelText('Dara Byrne, awaiting')).getByText('Awaiting'),
    ).toBeVisible()
  })

  it('reads Available and Unavailable for the two stored responses (AC2)', () => {
    const { rerender } = render(<PlayerResponseCard row={row({ response: 'available' })} />)
    expect(screen.getByLabelText('Dara Byrne, available')).toBeInTheDocument()
    rerender(<PlayerResponseCard row={row({ response: 'unavailable' })} />)
    expect(screen.getByLabelText('Dara Byrne, unavailable')).toBeInTheDocument()
  })

  it('offers three attendance states, all disabled when no handler is passed (AC7)', () => {
    render(<PlayerResponseCard row={row({ attended: null })} />)
    for (const name of ['Not recorded', 'Attended', 'Absent']) {
      const item = screen.getByRole('radio', { name })
      expect(item).toBeDisabled()
    }
    expect(screen.getByRole('radio', { name: 'Not recorded' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('marks the recorded state checked for a true and a false attendance row (AC7)', () => {
    const { rerender } = render(<PlayerResponseCard row={row({ attended: true })} />)
    expect(screen.getByRole('radio', { name: 'Attended' })).toHaveAttribute('aria-checked', 'true')
    rerender(<PlayerResponseCard row={row({ attended: false })} />)
    expect(screen.getByRole('radio', { name: 'Absent' })).toHaveAttribute('aria-checked', 'true')
  })

  it('does not fire the handler while disabled, and fires it mapped when enabled (S4.5 wiring)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<PlayerResponseCard row={row({ attended: null })} />)
    // No handler: clicking the disabled control does nothing.
    await user.click(screen.getByRole('radio', { name: 'Attended' }))

    rerender(<PlayerResponseCard row={row({ attended: null })} onAttendanceChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'Attended' }))
    expect(onChange).toHaveBeenCalledWith('u1', true)
    await user.click(screen.getByRole('radio', { name: 'Absent' }))
    expect(onChange).toHaveBeenLastCalledWith('u1', false)
  })

  it('disables the control and shows the line when a disabledReason is set', () => {
    render(<PlayerResponseCard row={row()} onAttendanceChange={vi.fn()} disabledReason="Off." />)
    expect(screen.getByRole('radio', { name: 'Not recorded' })).toBeDisabled()
    expect(screen.getByText('Off.')).toBeInTheDocument()
  })

  it('clears the row by re-tapping the selected state or tapping Not recorded (AC3)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    // Attended is selected; tapping it again is Radix deselect ('') → clear.
    const { rerender } = render(
      <PlayerResponseCard row={row({ attended: true })} onAttendanceChange={onChange} />,
    )
    await user.click(screen.getByRole('radio', { name: 'Attended' }))
    expect(onChange).toHaveBeenLastCalledWith('u1', null)

    // Absent selected; tapping Not recorded also clears.
    rerender(<PlayerResponseCard row={row({ attended: false })} onAttendanceChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'Not recorded' }))
    expect(onChange).toHaveBeenLastCalledWith('u1', null)
  })

  it('fires nothing when the already not-recorded row is re-tapped (no redundant clear)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PlayerResponseCard row={row({ attended: null })} onAttendanceChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'Not recorded' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
