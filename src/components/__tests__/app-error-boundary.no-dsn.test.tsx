import * as Sentry from '@sentry/react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { initSentry } from '@/lib/sentry'

function Bomb(): React.JSX.Element {
  throw new Error('render failed')
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

// The clean-checkout path (AC1): no DSN, so no client. The boundary must still be a boundary.
describe('<AppErrorBoundary /> with Sentry not initialised', () => {
  it('renders the crash screen with no client, and sends nothing', () => {
    initSentry()
    expect(Sentry.isInitialized()).toBe(false)

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    render(
      <AppErrorBoundary reload={vi.fn()}>
        <Bomb />
      </AppErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(Sentry.getClient()).toBeUndefined()
  })
})
