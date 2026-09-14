import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InstallContext } from '@/lib/install-context'
import { isDismissed, markShown, wasShown } from '@/lib/prompt-dismissal'

interface Ctx {
  context: InstallContext
  promptInstall: (() => Promise<'accepted' | 'dismissed' | 'unavailable'>) | null
}
const install: { value: Ctx } = {
  value: { context: 'installable', promptInstall: null },
}
vi.mock('@/features/install/install-context', () => ({
  useInstallContext: () => install.value,
}))

const { InstallGuideCard } = await import('@/features/install/install-guide-card')

beforeAll(() => {
  // Radix pointer/scroll handling is unimplemented in jsdom; stub it for the sheet.
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.setPointerCapture = () => undefined
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  localStorage.clear()
  install.value = { context: 'installable', promptInstall: null }
})

afterEach(() => {
  vi.restoreAllMocks()
})

const noop = (): void => undefined

describe('InstallGuideCard (S2.8)', () => {
  it('renders an Install button on installable and calls promptInstall exactly once (AC5)', async () => {
    const user = userEvent.setup()
    const promptInstall = vi.fn().mockResolvedValue('dismissed' as const)
    install.value = { context: 'installable', promptInstall }
    render(<InstallGuideCard onDismiss={noop} />)

    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(promptInstall).toHaveBeenCalledOnce()
  })

  it('hides permanently on accepted (AC6)', async () => {
    const user = userEvent.setup()
    const promptInstall = vi.fn().mockResolvedValue('accepted' as const)
    install.value = { context: 'installable', promptInstall }
    render(<InstallGuideCard onDismiss={noop} />)

    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    expect(isDismissed('install')).toBe(true)
  })

  it('writes the dismissed key on dismissed (AC6)', async () => {
    const user = userEvent.setup()
    const promptInstall = vi.fn().mockResolvedValue('dismissed' as const)
    install.value = { context: 'installable', promptInstall }
    render(<InstallGuideCard onDismiss={noop} />)

    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(isDismissed('install')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('falls back to the written Android steps when the event is unavailable (error state)', async () => {
    const user = userEvent.setup()
    const promptInstall = vi.fn().mockResolvedValue('unavailable' as const)
    install.value = { context: 'installable', promptInstall }
    render(<InstallGuideCard onDismiss={noop} />)

    await user.click(screen.getByRole('button', { name: 'Install' }))
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
    expect(screen.getByText('Tap the three dots at the top right.')).toBeInTheDocument()
    // The dismissed key is not written — the player has not decided anything (AC6).
    expect(isDismissed('install')).toBe(false)
  })

  it('renders "Show me how" on ios-safari and puts an svg in step one of the sheet (AC7)', async () => {
    const user = userEvent.setup()
    install.value = { context: 'ios-safari', promptInstall: null }
    render(<InstallGuideCard onDismiss={noop} />)

    await user.click(screen.getByRole('button', { name: 'Show me how' }))

    const dialog = await screen.findByRole('dialog')
    const stepOne = screen.getByText(/at the bottom of the screen/i)
    expect(dialog).toContainElement(stepOne)
    expect(stepOne.querySelector('svg')).toBeInTheDocument()
  })

  it('writes the dismissed key on Not now (AC4)', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    install.value = { context: 'ios-safari', promptInstall: null }
    render(<InstallGuideCard onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(isDismissed('install')).toBe(true)
  })

  it.each<InstallContext>(['ios-inapp', 'android-inapp', 'standalone', 'other', 'resolving'])(
    'renders nothing for %s (AC1)',
    (context) => {
      install.value = { context, promptInstall: null }
      const { container } = render(<InstallGuideCard onDismiss={noop} />)
      expect(container).toBeEmptyDOMElement()
    },
  )

  it('marks itself shown, and renders nothing once shown (AC3)', () => {
    install.value = { context: 'installable', promptInstall: vi.fn() }
    const first = render(<InstallGuideCard onDismiss={noop} />)
    expect(first.container).not.toBeEmptyDOMElement()
    expect(wasShown('install')).toBe(true)
    first.unmount()

    const second = render(<InstallGuideCard onDismiss={noop} />)
    expect(second.container).toBeEmptyDOMElement()
  })

  it('renders nothing when the shown key is already set (AC3)', () => {
    markShown('install')
    install.value = { context: 'installable', promptInstall: vi.fn() }
    const { container } = render(<InstallGuideCard onDismiss={noop} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the dismissed key is already set (AC4)', () => {
    // Set through the public API so the storage-key literal stays owned by prompt-dismissal.ts.
    localStorage.setItem('pfc.installGuideDismissed', '1')
    install.value = { context: 'ios-safari', promptInstall: null }
    const { container } = render(<InstallGuideCard onDismiss={noop} />)
    expect(container).toBeEmptyDOMElement()
  })
})
