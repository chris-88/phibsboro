import { describe, expect, it } from 'vitest'
import { workboxOptions } from '@/pwa/workbox'

const navigate = (mode: RequestMode) => ({ request: { mode } as Request })

describe('workbox options (AC7, D43)', () => {
  it('declares exactly one runtime route, for navigations only, network first with a 3s timeout', () => {
    expect(workboxOptions.runtimeCaching).toHaveLength(1)
    const [route] = workboxOptions.runtimeCaching
    expect(route.handler).toBe('NetworkFirst')
    expect(route.options.networkTimeoutSeconds).toBe(3)
    expect(route.options.cacheName).toBe('pfc-shell')
    expect(route.urlPattern(navigate('navigate'))).toBe(true)
    expect(route.urlPattern(navigate('cors'))).toBe(false)
    expect(route.urlPattern(navigate('no-cors'))).toBe(false)
    expect(route.urlPattern(navigate('same-origin'))).toBe(false)
  })

  it('names no origin, so a Supabase REST or RPC response can never be cached', () => {
    const serialised = JSON.stringify(workboxOptions, (_k, v: unknown) =>
      typeof v === 'function' ? v.toString() : v,
    )
    expect(serialised).not.toMatch(/supabase/i)
    expect(serialised).not.toContain(import.meta.env.VITE_SUPABASE_URL)
    expect(serialised).not.toMatch(/\/rest\/v1|\/auth\/v1|\/rpc\//)
  })

  it('turns both precache-first navigation paths off and takes control immediately', () => {
    expect(workboxOptions.navigateFallback).toBeNull()
    expect(workboxOptions.directoryIndex).toBeNull()
    expect(workboxOptions.skipWaiting).toBe(true)
    expect(workboxOptions.clientsClaim).toBe(true)
    expect(workboxOptions.cleanupOutdatedCaches).toBe(true)
  })

  it('falls back to the precached shell of the same build when the network and pfc-shell both miss (AC6)', () => {
    const [route] = workboxOptions.runtimeCaching
    expect(route.options.precacheFallback.fallbackURL).toBe('index.html')
    expect(route.options.expiration.maxEntries).toBe(1)
  })
})
