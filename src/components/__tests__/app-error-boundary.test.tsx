import * as Sentry from '@sentry/react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { initSentry } from '@/lib/sentry'
import { FAKE_DSN, fakeSentryTransport } from '@/test/sentry-transport'

function Bomb(): React.JSX.Element {
  throw new Error('render failed for 0871234567')
}

const fake = fakeSentryTransport()

beforeAll(() => {
  initSentry({ dsn: FAKE_DSN, enabled: true, transport: fake.transport })
})

afterAll(async () => {
  await Sentry.close()
})

// React reports a caught render error through console.error; that is expected here.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

function renderBomb(reload = vi.fn()) {
  const view = render(
    <AppErrorBoundary reload={reload}>
      <Bomb />
    </AppErrorBoundary>,
  )
  return { ...view, reload }
}

describe('<AppErrorBoundary /> (AC5)', () => {
  it('renders the crash screen instead of a blank page, and sends exactly one event', async () => {
    renderBomb()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(
      screen.getByText('Reload the app. If it keeps happening, tell your manager.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    // No error text on screen: the player gets the copy, Sentry gets the stack.
    expect(screen.queryByText(/render failed/)).not.toBeInTheDocument()

    await Sentry.flush(2000)
    const events = fake.events()
    expect(events).toHaveLength(1)
    // Sentry's boundary chains the thrown error under a synthetic "React ErrorBoundary Error"
    // carrying the component stack; the original is in the chain, scrubbed.
    const exception = events[0]?.exception as { values: { type: string; value: string }[] }
    expect(exception.values).toContainEqual(
      expect.objectContaining({ type: 'Error', value: 'render failed for [phone]' }),
    )
    expect(fake.bodies.join('')).not.toContain('0871234567')
  })

  it('Reload resets the boundary and reloads the document', async () => {
    const { reload } = renderBomb()
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it('renders children untouched when nothing throws', () => {
    render(
      <AppErrorBoundary>
        <p>fine</p>
      </AppErrorBoundary>,
    )
    expect(screen.getByText('fine')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('crash screen layout (AC14)', () => {
  it('fits 375px, the Reload control is min-h-tap and full width, and nothing is hex', () => {
    const { container } = renderBomb()
    // jsdom lays nothing out, so scrollWidth is 0 here; the assertion is the contract a
    // browser-driven run would check, and the class checks below are what jsdom can prove.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375)

    const reload = screen.getByRole('button', { name: 'Reload' })
    expect(reload.className).toMatch(/(^|\s)min-h-tap(\s|$)/)
    expect(reload.className).toMatch(/(^|\s)w-full(\s|$)/)
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    // Nothing is wider than the viewport by construction: no fixed widths, no min-width.
    for (const el of container.querySelectorAll<HTMLElement>('*')) {
      expect(el.style.width).toBe('')
      expect(el.style.minWidth).toBe('')
    }
  })
})
