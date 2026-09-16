import { render as rtlRender, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { BottomNav } from '@/components/bottom-nav'

// The nav renders router Links (S0.3), so every render needs a router around it.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

describe('BottomNav', () => {
  it('renders one item per role entry (Stats is a disabled placeholder, not a link)', () => {
    render(<BottomNav role="manager" currentPath="/" />)
    // Home, Manage, Squad are links; Stats (W8) is a disabled span, not a link.
    expect(screen.getAllByRole('link')).toHaveLength(3)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('shows Stats as present but disabled and non-navigable (W8)', () => {
    render(<BottomNav role="player" currentPath="/" />)
    const stats = screen.getByText('Stats').closest('[aria-disabled]')
    expect(stats).not.toBeNull()
    expect(screen.queryByRole('link', { name: /stats/i })).not.toBeInTheDocument()
  })

  it('marks the item matching currentPath as the current page (AC10)', () => {
    render(<BottomNav role="admin" currentPath="/manage" />)
    expect(screen.getByRole('link', { name: /manage/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /home/i })).not.toHaveAttribute('aria-current')
  })

  it('activates Manage from a deeper manage route', () => {
    render(<BottomNav role="manager" currentPath="/manage/event/new" />)
    expect(screen.getByRole('link', { name: /manage/i })).toHaveAttribute('aria-current', 'page')
  })

  it('distinguishes the active item by weight as well as colour, so it survives greyscale (AC10)', () => {
    render(<BottomNav role="manager" currentPath="/" />)
    expect(screen.getByRole('link', { name: /home/i }).className).toContain('font-semibold')
    expect(screen.getByRole('link', { name: /manage/i }).className).toContain('font-normal')
  })

  it('pads its bottom with the safe-area inset so no item sits under the home indicator (AC5)', () => {
    const { container } = render(<BottomNav role="player" currentPath="/" />)
    const nav = container.querySelector('nav')
    expect(nav?.className).toContain('fixed')
    expect(nav?.className).toContain('pb-[env(safe-area-inset-bottom)]')
  })

  it('links to the route path; the hash router turns it into #/… in the browser', () => {
    render(<BottomNav role="manager" currentPath="/" />)
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: /manage/i })).toHaveAttribute('href', '/manage')
  })
})
