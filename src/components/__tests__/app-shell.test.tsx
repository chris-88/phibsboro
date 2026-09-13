import { render as rtlRender, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AppShell, AppShellSkeleton } from '@/components/app-shell'

// The nav renders router Links (S0.3), so every render needs a router around it.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>)

describe('AppShell (AC8)', () => {
  it('renders the bottom nav for chrome="nav"', () => {
    render(
      <AppShell chrome="nav" role="player" currentPath="/">
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByText('content')).toBeInTheDocument()
  })

  it('renders no bottom nav for chrome="bare", and a back affordance instead', () => {
    render(
      <AppShell chrome="bare" role="player">
        <p>content</p>
      </AppShell>,
    )
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('gives the back affordance a 44px square target', () => {
    render(
      <AppShell chrome="bare" role="player">
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByRole('button', { name: 'Back' }).className).toContain('size-tap')
  })

  it('calls onBack when the back affordance is tapped', async () => {
    const onBack = vi.fn()
    render(
      <AppShell chrome="bare" role="player" onBack={onBack}>
        <p>content</p>
      </AppShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('shows the title when one is supplied', () => {
    render(
      <AppShell chrome="nav" role="player" title="Phibsboro FC" currentPath="/">
        <p>content</p>
      </AppShell>,
    )
    expect(screen.getByRole('heading', { name: 'Phibsboro FC' })).toBeInTheDocument()
  })

  // The clearance sits on the footer, the last in-flow element, since S0.4 put the
  // version tag below the content; everything above it clears the nav by construction.
  it('bottom-pads the content past the nav and the home indicator (AC6)', () => {
    const { container } = render(
      <AppShell chrome="nav" role="player" currentPath="/">
        <p>content</p>
      </AppShell>,
    )
    const footer = container.querySelector('footer')
    expect(footer?.className).toContain(
      'pb-[calc(var(--spacing-tap)+env(safe-area-inset-bottom)+1rem)]',
    )
    const nav = container.querySelector('nav')
    expect(nav && footer?.compareDocumentPosition(nav)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  // jsdom computes no layout, so this cannot measure a rendered width. What it can prove
  // is that nothing in the shell is pinned to a width the viewport cannot hold. The real
  // check is the AC14 screenshot at 375x667 and the S7.4 device pass.
  it('pins no element to a fixed width wider than 375px (AC1)', () => {
    const { container } = render(
      <AppShell chrome="nav" role="manager" title="Phibsboro FC" currentPath="/manage">
        <p>content</p>
      </AppShell>,
    )
    for (const el of container.querySelectorAll<HTMLElement>('*')) {
      expect(el.getAttribute('class') ?? '').not.toMatch(/(^|[\s:])w-\[\d+px\]/)
      expect(el.getAttribute('style') ?? '').not.toMatch(/(^|;)\s*(min-)?width/i)
    }
  })
})

describe('AppShellSkeleton', () => {
  it('renders nav-shaped chrome and no login form', () => {
    const { container } = render(<AppShellSkeleton />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(1)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
