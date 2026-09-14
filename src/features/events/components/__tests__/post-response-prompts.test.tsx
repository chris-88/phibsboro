import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InstallContext } from '@/lib/install-context'

const hoisted = vi.hoisted(
  (): { context: { value: InstallContext }; hasResponded: { value: boolean } } => ({
    context: { value: 'other' },
    hasResponded: { value: true },
  }),
)

vi.mock('@/features/install/install-context', () => ({
  useInstallContext: () => ({ context: hoisted.context.value, promptInstall: null }),
}))

interface PromptState {
  hasRespondedThisSession: boolean
  markResponded: () => void
}
vi.mock('@/stores/prompt-store', () => ({
  usePromptStore: <T,>(selector: (s: PromptState) => T): T =>
    selector({
      hasRespondedThisSession: hoisted.hasResponded.value,
      markResponded: () => undefined,
    }),
}))

const { PostResponsePrompts } = await import('@/features/events/components/PostResponsePrompts')

const escapeLine = /open in (safari|chrome) to add this to your home screen/i

beforeEach(() => {
  hoisted.context.value = 'other'
  hoisted.hasResponded.value = true
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const IN_APP: InstallContext[] = ['ios-inapp', 'android-inapp']
const NOT_PROMPTED: InstallContext[] = [
  'resolving',
  'standalone',
  'installable',
  'ios-safari',
  'other',
]

describe('PostResponsePrompts exclusivity gate (D46)', () => {
  it.each(IN_APP)('renders the escape prompt in %s and never an install card (AC11)', (context) => {
    hoisted.context.value = context
    render(<PostResponsePrompts />)
    expect(screen.getByText(escapeLine)).toBeInTheDocument()
    // The escape prompt is the only prompt on screen: exactly one status region.
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('names Safari on iOS and Chrome on Android (AC6)', () => {
    hoisted.context.value = 'ios-inapp'
    const { rerender } = render(<PostResponsePrompts />)
    expect(screen.getByText(/open in safari/i)).toBeInTheDocument()

    hoisted.context.value = 'android-inapp'
    rerender(<PostResponsePrompts />)
    expect(screen.getByText(/open in chrome/i)).toBeInTheDocument()
  })

  it.each(NOT_PROMPTED)('renders nothing in %s', (context) => {
    hoisted.context.value = context
    const { container } = render(<PostResponsePrompts />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing until the player has responded, in every context (AC4)', () => {
    hoisted.hasResponded.value = false
    for (const context of [...IN_APP, ...NOT_PROMPTED]) {
      hoisted.context.value = context
      const { container, unmount } = render(<PostResponsePrompts />)
      expect(container).toBeEmptyDOMElement()
      unmount()
    }
  })

  it('does not return on a later response once dismissed in the same browser (AC9)', async () => {
    const user = userEvent.setup()
    hoisted.context.value = 'ios-inapp'
    const { unmount } = render(<PostResponsePrompts />)
    expect(screen.getByText(escapeLine)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /not now/i }))
    expect(screen.queryByText(escapeLine)).not.toBeInTheDocument()
    unmount()

    // A second response, a second event: the dismissal persists, so nothing shows.
    render(<PostResponsePrompts />)
    expect(screen.queryByText(escapeLine)).not.toBeInTheDocument()
  })
})
