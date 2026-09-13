import { afterEach, describe, expect, it } from 'vitest'
import { nextRouteAfterAuth } from '@/features/auth/after-auth'
import { clearIntendedRoute, setIntendedRoute } from '@/lib/intended-route'

afterEach(() => {
  localStorage.clear()
  clearIntendedRoute()
})

describe('nextRouteAfterAuth (the warm path, AC20)', () => {
  it('returns the stored intended route once, then home', () => {
    setIntendedRoute('/event/abc')
    // First call — the form submit — consumes it.
    expect(nextRouteAfterAuth()).toBe('/event/abc')
    // Second call — a later sign-in from the menu — gets home, because it was consumed (AC8).
    expect(nextRouteAfterAuth()).toBe('/')
  })

  it('returns home when nothing is stored', () => {
    expect(nextRouteAfterAuth()).toBe('/')
  })

  it('returns home for a stored waypoint (it was never written, AC9)', () => {
    setIntendedRoute('/login')
    expect(nextRouteAfterAuth()).toBe('/')
  })
})
