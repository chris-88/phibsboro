import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ResponsePill } from '@/features/availability/components/ResponsePill'

// S3.2 AC5: the three availability states, each a distinct word (and a distinct glyph, so they are
// separable without colour). The reusable value-taking pill S4.4 renders against another player.
describe('ResponsePill (S3.2)', () => {
  it('reads "Available" for an available response', () => {
    render(<ResponsePill response="available" />)
    expect(screen.getByText('Available')).toBeInTheDocument()
  })

  it('reads "Unavailable" for an unavailable response', () => {
    render(<ResponsePill response="unavailable" />)
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('reads "Awaiting" for no response row (D12)', () => {
    render(<ResponsePill response={null} />)
    expect(screen.getByText('Awaiting')).toBeInTheDocument()
  })
})
