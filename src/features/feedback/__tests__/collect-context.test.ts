import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/version', () => ({ getAppVersion: () => 'abc1234' }))
vi.mock('@/lib/standalone', () => ({ isStandalone: () => true }))

const { collectContext } = await import('@/features/feedback/collect-context')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('collectContext (S12.2)', () => {
  it('captures the passed route and the running build', () => {
    const ctx = collectContext('/event/abc')
    expect(ctx.route).toBe('/event/abc')
    expect(ctx.release).toBe('abc1234')
  })

  it('captures device context: user agent, standalone and viewport', () => {
    const ctx = collectContext('/')
    expect(typeof ctx.user_agent).toBe('string')
    expect(ctx.standalone).toBe(true)
    expect(ctx.viewport).toMatch(/^\d+x\d+$/)
  })

  it('never throws when isStandalone throws, keeping the fields gathered first', async () => {
    vi.resetModules()
    vi.doMock('@/lib/version', () => ({ getAppVersion: () => 'abc1234' }))
    vi.doMock('@/lib/standalone', () => ({
      isStandalone: () => {
        throw new Error('no matchMedia')
      },
    }))
    const mod = await import('@/features/feedback/collect-context')
    const ctx = mod.collectContext('/x')
    expect(ctx.route).toBe('/x')
    expect(ctx.release).toBe('abc1234')
    expect(ctx.viewport).toMatch(/^\d+x\d+$/) // gathered before the throw
    expect(ctx.standalone).toBeUndefined()
  })
})
