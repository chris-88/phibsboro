import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InstallContext } from '@/lib/install-context'

const standalone = { value: false }
vi.mock('@/lib/standalone', () => ({ isStandalone: () => standalone.value }))

interface Ctx {
  context: InstallContext
  promptInstall: (() => Promise<'accepted' | 'dismissed' | 'unavailable'>) | null
}
const ctx: { value: Ctx } = { value: { context: 'ios-safari', promptInstall: null } }
vi.mock('@/features/install/install-context', () => ({
  useInstallContext: () => ctx.value,
}))

const { useInstallMenuItem } = await import('@/features/install/use-install-menu-item')

beforeEach(() => {
  standalone.value = false
  ctx.value = { context: 'ios-safari', promptInstall: null }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useInstallMenuItem (S2.8)', () => {
  it('is hidden when installed (AC2)', () => {
    standalone.value = true
    ctx.value = { context: 'ios-safari', promptInstall: null }
    const { result } = renderHook(() => useInstallMenuItem())
    expect(result.current.visible).toBe(false)
  })

  it('is hidden on desktop and while Android is still resolving (AC8)', () => {
    ctx.value = { context: 'other', promptInstall: null }
    expect(renderHook(() => useInstallMenuItem()).result.current.visible).toBe(false)

    ctx.value = { context: 'resolving', promptInstall: null }
    expect(renderHook(() => useInstallMenuItem()).result.current.visible).toBe(false)
  })

  it('is visible on iOS Safari, opening the iOS steps (AC8)', () => {
    ctx.value = { context: 'ios-safari', promptInstall: null }
    const { result } = renderHook(() => useInstallMenuItem())
    expect(result.current.visible).toBe(true)
    expect(result.current.variant).toBe('ios')
  })

  it('flips to the Install branch when a late event arrives, leaving the context frozen', () => {
    // The automatic slot is driven by `context`; the menu item reads the latest promptInstall.
    ctx.value = { context: 'android-inapp', promptInstall: null }
    const first = renderHook(() => useInstallMenuItem())
    expect(first.result.current.visible).toBe(true)
    expect(first.result.current.variant).toBe('android')

    // A late beforeinstallprompt populates promptInstall without reclassifying the context (D45).
    ctx.value = { context: 'android-inapp', promptInstall: vi.fn() }
    first.rerender()
    expect(first.result.current.variant).toBe('installable')
    // The automatic gate's input is unchanged: it still reads android-inapp → the escape prompt.
    expect(ctx.value.context).toBe('android-inapp')
  })
})
