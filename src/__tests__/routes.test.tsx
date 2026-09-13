import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { RootLayout } from '@/components/root-layout'
import { RouteError } from '@/components/route-error'
import EventScreen from '@/features/events/event-screen'
import { TITLE_SUFFIX } from '@/lib/document-title'
import { routeTable, routes } from '@/routes'

const UUID = '9f1c0b8e-0000-4000-8000-000000000000'

const mount = (initial: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [initial] })
  render(<RouterProvider router={router} />)
  return router
}

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
    ['/', 'S3.1'],
    ['/login', 'S2.2'],
    ['/register', 'S2.1'],
    ['/join/abc123', 'S2.4'],
    ['/reset/abc123', 'S2.3'],
    [`/event/${UUID}`, 'S3.3'],
    ['/history', 'S3.5'],
    ['/manage', 'S4.1'],
    ['/manage/event/new', 'S4.1'],
    [`/manage/event/${UUID}`, 'S4.3'],
    // /admin is a real screen from S6.1, and /manage/team/:teamId/members from S6.2, both no
    // longer placeholders; admin-screen.test.tsx and team-members-screen.test.tsx cover them.
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
    const card = await placeholder()
    expect(card).toHaveTextContent('New event')
    expect(card).not.toHaveTextContent('Manage event')
    expect(card).not.toHaveTextContent('id: new')
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
    await placeholder()
    expect(nav()).toBeInTheDocument()
  })

  it('shows the bottom nav on a lazy manager route', async () => {
    mount('/manage')
    await placeholder()
    expect(nav()).toBeInTheDocument()
  })

  it('hides the bottom nav on /event/:id and shows a back affordance', async () => {
    mount(`/event/${UUID}`)
    await placeholder()
    expect(nav()).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
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
    await placeholder()
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
