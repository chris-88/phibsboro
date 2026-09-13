import { afterEach, describe, expect, it } from 'vitest'
import { currentHashPath } from '@/app/router'

/**
 * `currentHashPath()` feeds the expiry teardown the route the player was on, so S2.5 can return
 * them (AC10). It reads the fragment HashRouter owns and never returns an absolute URL.
 */
describe('currentHashPath', () => {
  afterEach(() => {
    window.location.hash = ''
  })

  it('returns / for an empty fragment', () => {
    window.location.hash = ''
    expect(currentHashPath()).toBe('/')
  })

  it('strips the leading # and keeps the route path', () => {
    window.location.hash = '#/event/abc?x=1'
    expect(currentHashPath()).toBe('/event/abc?x=1')
  })

  it('normalises a fragment with no leading slash', () => {
    window.location.hash = '#history'
    expect(currentHashPath()).toBe('/history')
  })
})
