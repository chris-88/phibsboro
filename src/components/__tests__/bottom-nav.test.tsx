import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BottomNav } from '@/components/bottom-nav'

describe('BottomNav', () => {
  it('renders one item per role entry', () => {
    render(<BottomNav role="manager" currentPath="/" />)
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it('marks the item matching currentPath as the current page (AC10)', () => {
    render(<BottomNav role="admin" currentPath="/history" />)
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /home/i })).not.toHaveAttribute('aria-current')
  })

  it('activates Manage from a deeper manage route', () => {
    render(<BottomNav role="manager" currentPath="/manage/event/new" />)
    expect(screen.getByRole('link', { name: /manage/i })).toHaveAttribute('aria-current', 'page')
  })

  it('distinguishes the active item by weight as well as colour, so it survives greyscale (AC10)', () => {
    render(<BottomNav role="player" currentPath="/" />)
    expect(screen.getByRole('link', { name: /home/i }).className).toContain('font-semibold')
    expect(screen.getByRole('link', { name: /history/i }).className).toContain('font-normal')
  })

  it('pads its bottom with the safe-area inset so no item sits under the home indicator (AC5)', () => {
    const { container } = render(<BottomNav role="player" currentPath="/" />)
    const nav = container.querySelector('nav')
    expect(nav?.className).toContain('fixed')
    expect(nav?.className).toContain('pb-[env(safe-area-inset-bottom)]')
  })

  it('links through the hash, which is what HashRouter reads', () => {
    render(<BottomNav role="player" currentPath="/" />)
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('href', '#/history')
  })
})
