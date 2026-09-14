import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

// S2.9 wraps the guarded routes in RequireAuth/RequireManager/RequireAdmin, which read
// useCurrentUser(). This suite is about the route table and chrome, not the guards (those have
// their own suite), so it signs in a ready admin: every guard admits, and every route resolves
// to its screen the way it did before the guards existed.
// RootLayout mounts PendingJoinGate (S2.4), whose resume hook needs a query client this route-table
// suite does not provide. The resume is not what these tests probe, so pass its children through.
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

import { RootLayout } from '@/components/root-layout'
import { RouteError } from '@/components/route-error'
import EventScreen from '@/features/events/routes/EventDetailScreen'
import { TITLE_SUFFIX } from '@/lib/document-title'
import { routeTable, routes } from '@/routes'

const UUID = '9f1c0b8e-0000-4000-8000-000000000000'

// The real home screen (S3.1) mounts a TanStack Query hook, so the route table now needs a client
// in context — the admin fixture has no memberships, so `/` settles on its no-team state and fires
// no request, but the hook is still called.
const mount = (initial: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [initial] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

// The team-less admin fixture lands the real home screen on its no-team empty state.
const HOME_NO_TEAM = "You're not on a team yet."

const placeholder = () => screen.findByTestId('route-placeholder')

describe('route table (D34)', () => {
  it('lists every D34 route exactly once, plus the catch-all', () => {
    const paths = routeTable.map((r) => r.path)
    expect(paths).toEqual([
      '/',
      '/login',
      '/register',
      '/join/:token',
      '/reset/:token',
      '/event/:id',
      '/history',
      '/manage',
      '/manage/event/new',
      '/manage/event/:id',
      '/manage/team/:teamId/members',
      '/admin',
      '*',
    ])
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('gives every route a chrome, a guard and a title', () => {
    for (const route of routeTable) {
      expect(['nav', 'bare']).toContain(route.chrome)
      expect(['public', 'authed', 'manager', 'admin']).toContain(route.guard)
      expect(route.title.length).toBeGreaterThan(0)
    }
  })

  // AC4: D41 names the first four bare routes; /login and the 404 are bare for the same
  // reason — neither has anywhere to navigate to.
  it('hides the bottom nav on deep-link targets and shows it everywhere else (AC4, D41)', () => {
    const chrome = Object.fromEntries(routeTable.map((r) => [r.path, r.chrome]))
    expect(chrome).toEqual({
      '/': 'nav',
      '/login': 'bare',
      '/register': 'bare',
      '/join/:token': 'bare',
      '/reset/:token': 'bare',
      '/event/:id': 'bare',
      '/history': 'nav',
      '/manage': 'nav',
      '/manage/event/new': 'nav',
      '/manage/event/:id': 'nav',
      '/manage/team/:teamId/members': 'nav',
      '/admin': 'nav',
      '*': 'bare',
    })
  })

  it('keeps /event/:id public so a stranger from WhatsApp can see the event (D6, D7)', () => {
    expect(routeTable.find((r) => r.path === '/event/:id')?.guard).toBe('public')
  })
})

describe('resolving routes (AC1, AC15)', () => {
  const cases: [string, string][] = [
    // `/` is a real screen from S3.1 — no longer a placeholder; the home-screen suite and the
    // chrome and title cases below assert it directly.
    ['/reset/abc123', 'S2.3'],
    // /event/:id is a real screen from S3.3 and /join/:token from S2.4 — no longer placeholders;
    // EventDetailScreen, JoinByTokenScreen and the routes coverage below assert them directly.
    ['/history', 'S3.5'],
    [`/manage/event/${UUID}`, 'S4.3'],
    // /manage and /manage/event/new are real screens from S4.1 — no longer placeholders; the
    // new-event and admit tests below and manage-screen behaviour cover them. /login is a real
    // screen from S2.2, /register from S2.1, /admin from S6.1 and /manage/team/:teamId/members
    // from S6.2 — no longer placeholders; their own suites cover them.
  ]

  it.each(cases)('%s renders a placeholder naming its owning story %s', async (path, story) => {
    mount(path)
    const card = await placeholder()
    expect(card).toHaveAttribute('data-story', story)
    expect(card).toHaveTextContent(`Story ${story} builds this screen`)
  })

  it('shows the segment value on parameterised routes', async () => {
    mount(`/manage/event/${UUID}`)
    expect(await placeholder()).toHaveTextContent(`id: ${UUID}`)
  })

  it('renders the new-event screen for /manage/event/new, not the edit screen with id "new" (AC2)', async () => {
    mount('/manage/event/new')
    // The real S4.1 new-event screen renders (its empty state, since the admin fixture manages no
    // team) — not the S4.3 manage-event placeholder a literal ":id" of "new" would resolve to.
    await screen.findByText("You don't manage a team yet.")
    expect(screen.queryByTestId('route-placeholder')).not.toBeInTheDocument()
  })

  it('still routes a real id to the manage-event screen (AC2)', async () => {
    mount(`/manage/event/${UUID}`)
    const card = await placeholder()
    expect(card).toHaveTextContent('Manage event')
    expect(card).toHaveTextContent(`id: ${UUID}`)
  })
})

describe('chrome per route (AC3, AC4)', () => {
  const nav = () => screen.queryByRole('navigation', { name: 'Main' })

  it('shows the bottom nav on /', async () => {
    mount('/')
    await screen.findByText(HOME_NO_TEAM)
    expect(nav()).toBeInTheDocument()
  })

  it('shows the bottom nav on a lazy manager route', async () => {
    mount('/manage')
    // The real S4.1 manage screen (its empty state for the team-less admin fixture) confirms the
    // lazy chunk resolved before asserting the nav.
    await screen.findByText("You don't manage a team yet.")
    expect(nav()).toBeInTheDocument()
  })

  it('hides the bottom nav on /event/:id and shows a back affordance', async () => {
    mount(`/event/${UUID}`)
    // No session in this harness, so the real screen sits on its loading skeleton; the shell
    // chrome is what this asserts.
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(nav()).not.toBeInTheDocument()
  })

  it('renders the 404 screen for an unknown route with one 44px action home and no nav (AC3)', () => {
    mount('/nope')
    expect(screen.getByRole('heading', { name: 'Nothing here.' })).toBeInTheDocument()
    expect(nav()).not.toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    const [home] = links
    expect(home).toHaveAttribute('href', '/')
    expect(home).toHaveTextContent('Go to the app')
    // min-h-12 is 48px, above the 44px floor (D40).
    expect(home?.className).toMatch(/(^|\s)(min-h-tap|min-h-12)(\s|$)/)
  })
})

describe('document title (AC13)', () => {
  it('changes per route and always carries the one suffix', async () => {
    const router = mount('/')
    await screen.findByText(HOME_NO_TEAM)
    expect(document.title).toBe(`Home${TITLE_SUFFIX}`)

    await act(() => router.navigate('/history'))
    expect(await placeholder()).toHaveAttribute('data-story', 'S3.5')
    expect(document.title).toBe(`History${TITLE_SUFFIX}`)

    await act(() => router.navigate('/nope'))
    await screen.findByRole('heading', { name: 'Nothing here.' })
    expect(document.title).toBe(`Nothing here.${TITLE_SUFFIX}`)
  })

  it('has every table title end up with the suffix and no title carrying it twice', () => {
    for (const route of routeTable) {
      expect(route.title).not.toContain(TITLE_SUFFIX)
    }
  })
})

describe('route error element (AC10, AC11)', () => {
  function Boom(): never {
    throw new Error('kaboom')
  }

  const mountThrowing = (reload: () => void) => {
    const router = createMemoryRouter(
      [{ path: '/', element: <Boom />, errorElement: <RouteError reload={reload} /> }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)
  }

  it('renders an inline message, a Try again that reloads, and a link home', async () => {
    const reload = vi.fn()
    // React logs the thrown error to the console; that is expected here.
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mountThrowing(reload)

    const alert = screen.getByRole('alert')
    expect(within(alert).getByText('Something went wrong.')).toBeInTheDocument()
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(reload).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Go to the app' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
    expect(document.title).toBe(`Something went wrong.${TITLE_SUFFIX}`)
    vi.restoreAllMocks()
  })

  it('renders the 404 screen, not the error screen, for a missing route param', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    // The real root layout and error element, with one route that declares no segment but
    // whose screen asks for one.
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: <RootLayout />,
          errorElement: <RouteError />,
          children: [
            {
              path: '/broken',
              handle: { path: '/broken', chrome: 'bare', guard: 'public', title: 'Broken' },
              element: <EventScreen />,
            },
          ],
        },
      ],
      { initialEntries: ['/broken'] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { name: 'Nothing here.' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the app' })).toBeInTheDocument()
    expect(document.title).toBe(`Nothing here.${TITLE_SUFFIX}`)
    vi.restoreAllMocks()
  })
})
