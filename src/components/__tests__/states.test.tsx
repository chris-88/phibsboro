import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'

describe('LoadingState (AC9)', () => {
  it('draws skeleton cards rather than a spinner', () => {
    const { container } = render(<LoadingState rows={4} />)
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(8)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  })
})

describe('EmptyState (AC9)', () => {
  it('renders a title, optional body and optional action', () => {
    render(
      <EmptyState
        title="No upcoming events"
        body="Your manager has not added anything yet."
        action={<Button>Refresh</Button>}
      />,
    )
    expect(screen.getByText('No upcoming events')).toBeInTheDocument()
    expect(screen.getByText('Your manager has not added anything yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('renders without a body or an action', () => {
    render(<EmptyState title="No past events yet." />)
    expect(screen.getByText('No past events yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('ErrorState (AC9)', () => {
  it('always renders a retry control, never a blank screen', () => {
    render(<ErrorState onRetry={vi.fn()} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('calls onRetry when the retry control is tapped', async () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
