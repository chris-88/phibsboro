import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { USER_AGENT_FIXTURES } from '@/lib/__fixtures__/user-agents'

const standalone = { value: false }
vi.mock('@/lib/standalone', () => ({ isStandalone: () => standalone.value }))

const { InstallProvider } = await import('@/features/install/install-provider')
const { useInstallContext } = await import('@/features/install/install-context')

const uaFor = (label: string): string => {
  const row = USER_AGENT_FIXTURES.find((f) => f.label === label)
  if (!row) throw new Error(`no fixture labelled ${label}`)
  return row.ua
}
const ANDROID = uaFor('Android Chrome')
const IOS_WHATSAPP = uaFor('WhatsApp iOS')

function setUa(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
}

interface FiredPrompt {
  prompt: ReturnType<typeof vi.fn>
}

function fireBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted'): FiredPrompt {
  const prompt = vi.fn().mockResolvedValue(undefined)
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt,
    userChoice: Promise.resolve({ outcome }),
  })
  window.dispatchEvent(event)
  return { prompt }
}

const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
  <InstallProvider>{children}</InstallProvider>
)

const renderProvider = () => renderHook(() => useInstallContext(), { wrapper })

beforeEach(() => {
  standalone.value = false
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('InstallProvider', () => {
  it('resolves installable when beforeinstallprompt fires inside the window (1500ms)', () => {
    setUa(ANDROID)
    const { result } = renderProvider()
    expect(result.current.context).toBe('resolving')

    act(() => {
      vi.advanceTimersByTime(1500)
      fireBeforeInstallPrompt()
    })
    expect(result.current.context).toBe('installable')
    expect(result.current.promptInstall).not.toBeNull()
  })

  it('resolves android-inapp when no event fires, at exactly 3000ms and not before (AC2)', () => {
    setUa(ANDROID)
    const { result } = renderProvider()

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(result.current.context).toBe('resolving')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.context).toBe('android-inapp')
    expect(result.current.promptInstall).toBeNull()
  })

  it('a late event (4000ms) leaves android-inapp but still populates promptInstall', async () => {
    setUa(ANDROID)
    const { result } = renderProvider()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(result.current.context).toBe('android-inapp')

    const fired = { current: null as FiredPrompt | null }
    act(() => {
      vi.advanceTimersByTime(1000)
      fired.current = fireBeforeInstallPrompt('accepted')
    })
    // The window has shut: the context does not flip out from under the player (D45)...
    expect(result.current.context).toBe('android-inapp')
    // ...but the captured event is still available to S2.8.
    expect(result.current.promptInstall).not.toBeNull()

    await act(async () => {
      await result.current.promptInstall?.()
    })
    expect(fired.current?.prompt).toHaveBeenCalledOnce()
    // Spent once, then dropped.
    expect(result.current.promptInstall).toBeNull()
  })

  it('resolves standalone and registers no beforeinstallprompt listener (AC3)', () => {
    standalone.value = true
    setUa(IOS_WHATSAPP)
    const addListener = vi.spyOn(window, 'addEventListener')
    const { result } = renderProvider()

    expect(result.current.context).toBe('standalone')
    expect(addListener.mock.calls.some(([type]) => type === 'beforeinstallprompt')).toBe(false)
  })

  it('resolves ios-inapp synchronously for a WhatsApp iOS UA', () => {
    setUa(IOS_WHATSAPP)
    const { result } = renderProvider()
    expect(result.current.context).toBe('ios-inapp')
  })
})
