import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventMeta } from '@/features/events/components/EventMeta'

const base = {
  startsAt: '2026-09-12T13:30:00Z',
  location: 'Bogies',
}

describe('EventMeta — jersey line (S15.1)', () => {
  it('shows the jersey label when a kit is set', () => {
    render(<EventMeta {...base} jersey="sky" />)
    expect(screen.getByText('Jersey: Light Blue')).toBeInTheDocument()
  })

  it('shows Black and White for those kits', () => {
    const { rerender } = render(<EventMeta {...base} jersey="black" />)
    expect(screen.getByText('Jersey: Black')).toBeInTheDocument()
    rerender(<EventMeta {...base} jersey="white" />)
    expect(screen.getByText('Jersey: White')).toBeInTheDocument()
  })

  it('shows no jersey line when unset (training/social, or a match with none)', () => {
    render(<EventMeta {...base} jersey={null} />)
    expect(screen.queryByText(/Jersey:/)).not.toBeInTheDocument()
  })
})
