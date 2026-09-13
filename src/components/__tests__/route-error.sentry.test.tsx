import * as Sentry from '@sentry/react'
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { RootLayout } from '@/components/root-layout'
import { RouteError } from '@/components/route-error'
import { initSentry } from '@/lib/sentry'
import { useRouteParam } from '@/lib/use-route-param'
import { FAKE_DSN, fakeSentryTransport } from '@/test/sentry-transport'

// RootLayout reads useCurrentUser() (S2.9). This suite probes the route error/404 paths, not the
// guards, and mounts a bare custom router with no providers, so stub a ready user rather than
// stand up a session and a query client.
// RootLayout mounts PendingJoinGate (S2.4), whose resume hook uses a query client this
// provider-less suite does not stand up. It is not under test here, so pass its children through.
vi.mock('@/features/teams/PendingJoinGate', () => ({
  PendingJoinGate: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/features/auth/use-current-user', () => {
  const user = {
    id: 'admin',
    name: 'Admin',
    phone: '+353870000000',
    isAdmin: true,
    memberships: [],
    managedTeams: [],
    isManagerOfAny: true,
    roleForTeam: () => null,
    isManagerOf: () => true,
  }
  return {
    useCurrentUser: () => ({ status: 'ready', user }),
    useSignedInUser: () => user,
  }
})

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

function Boom(): never {
  throw new Error('screen failed for 0871234567')
}

function NeedsParam(): React.JSX.Element {
  return <p>{useRouteParam('id')}</p>
}

/** The tree App.tsx builds: Sentry's boundary outside the router, the route `errorElement`
 *  inside it. The route element wins, so it is the one that has to report. */
function mount(element: React.JSX.Element, path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout />,
        errorElement: <RouteError reload={vi.fn()} />,
        children: [
          {
            path,
            handle: { path, chrome: 'bare', guard: 'public', title: 'Probe' },
            element,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>,
  )
}

describe('a screen that throws inside the router (AC5)', () => {
  it('shows the route error screen and sends exactly one scrubbed event', async () => {
    const before = fake.events().length
    mount(<Boom />, '/boom')

    // The route-level element catches first; the root crash screen is never reached.
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument()
    expect(screen.queryByText(/screen failed/)).not.toBeInTheDocument()

    await Sentry.flush(2000)
    const events = fake.events().slice(before)
    expect(events).toHaveLength(1)
    const exception = events[0]?.exception as {
      values: { type: string; value: string; mechanism?: { type: string; handled: boolean } }[]
    }
    expect(exception.values).toContainEqual(
      expect.objectContaining({
        type: 'Error',
        value: 'screen failed for [phone]',
        mechanism: expect.objectContaining({ handled: true }) as unknown,
      }),
    )
    expect(fake.bodies.join('')).not.toContain('0871234567')
  })

  it('reports nothing for a missing route param, which is a bad link and gets the 404', async () => {
    const before = fake.events().length
    mount(<NeedsParam />, '/no-param')

    expect(screen.getByRole('heading', { name: 'Nothing here.' })).toBeInTheDocument()
    await Sentry.flush(2000)
    expect(fake.events().slice(before)).toHaveLength(0)
  })
})
