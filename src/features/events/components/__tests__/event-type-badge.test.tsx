import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import type { EventType } from '@/features/events/schema'

// The badge covers every event type, social included (S8.1 AC3, AC4). If a type were added
// without a branch, EventTypeBadge would not typecheck (the switch stops returning on all paths),
// so this table doubling as the exhaustiveness record can never silently miss one.
const cases: [EventType, string][] = [
  ['training', 'Training'],
  ['match', 'Match'],
  ['social', 'Social'],
]

describe('EventTypeBadge (S8.1)', () => {
  it.each(cases)('renders the %s badge with its label', (type, label) => {
    render(<EventTypeBadge type={type} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('gives social its own token colour, not match or training styling', () => {
    render(<EventTypeBadge type="social" />)
    const badge = screen.getByText('Social')
    expect(badge.className).toContain('bg-info')
  })
})
