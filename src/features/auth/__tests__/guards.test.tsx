import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser, CurrentUserState } from '@/features/auth/use-current-user'

const hoisted = vi.hoisted(() => ({
  account: { value: null as unknown as CurrentUserState },
  toast: vi.fn(),
}))

vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => hoisted.account.value,
  useSignedInUser: (): CurrentUser => {
    const s: CurrentUserState = hoisted.account.value
    if (s.status !== 'ready') throw new Error('useSignedInUser outside RequireAuth')
    return s.user
  },
}))
// Stub sonner so `toast` is observable and AppShell's <Toaster /> is a no-op.
vi.mock('sonner', () => ({
  toast: (msg: string) => {
    hoisted.toast(msg)
  },
  Toaster: () => null,
}))
// AdminScreen (real) renders under the admin route; stub its data hooks so it needs no backend.
vi.mock('@/api/teams', () => ({
  useTeams: () => ({
    isPending: false,
    isError: false,
    isSuccess: true,
    data: [],
    refetch: vi.fn(),
  }),
  useCreateTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useRenameTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useSetTeamActive: () => ({ mutate: vi.fn(), isPending: false }),
}))

const { routes, routeTable } = await import('@/routes')

const UUID = '9f1c0b8e-0000-4000-8000-000000000000'
const TOKEN = 'tok123'

const ready = (over: Partial<CurrentUser>): CurrentUserState => ({
  status: 'ready',
  user: {
    id: 'u1',
    name: 'U',
    phone: '+353870000000',
    isAdmin: false,
    avatarPath: null,
    memberships: [],
    managedTeams: [],
    administrableTeams: [],
    isManagerOfAny: false,
    roleForTeam: () => null,
    isManagerOf: () => false,
    ...over,
  },
})

function mount(initial: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initial] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.scrollIntoView = () => undefined
})

beforeEach(() => {
  hoisted.account.value = ready({})
  hoisted.toast.mockClear()
  localStorage.clear()
})

describe('RequireAuth (AC6, AC8)', () => {
  it('renders the chrome skeleton while the account is loading, not the login screen', () => {
    hoisted.account.value = { status: 'loading' }
    const router = mount('/')
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('sends a signed-out visitor to /login and records the intended route', async () => {
    hoisted.account.value = { status: 'signedOut' }
    const router = mount('/profile')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
    const stored = JSON.parse(localStorage.getItem('pfc.intendedRoute') ?? '{}') as {
      path?: string
    }
    expect(stored.path).toBe('/profile')
  })
})

describe('RequireManager (AC4)', () => {
  it('redirects a player off /manage without rendering the manager screen', async () => {
    hoisted.account.value = ready({}) // a plain player
    const router = mount('/manage')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
    // The manager screen (S4.1's placeholder) never mounts, not even for a frame.
    expect(screen.queryByText(/Story S4\.1/)).not.toBeInTheDocument()
    expect(hoisted.toast).toHaveBeenCalledWith("You don't manage a team.")
  })

  it('admits a manager to /manage', async () => {
    hoisted.account.value = ready({ isManagerOfAny: true })
    const router = mount('/manage')
    // The real S4.1 manage screen renders — its empty state here, since this fixture manages no
    // team — rather than the guard redirecting home.
    await waitFor(() => {
      expect(screen.getByText("You don't manage a team yet.")).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/manage')
  })
})

describe('RequireAdmin (AC5)', () => {
  it('redirects a manager who is not an admin off /admin', async () => {
    hoisted.account.value = ready({ isManagerOfAny: true, isAdmin: false })
    const router = mount('/admin')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('admits an admin to /admin', async () => {
    hoisted.account.value = ready({ isAdmin: true, isManagerOfAny: true, isManagerOf: () => true })
    const router = mount('/admin')
    // AdminScreen (data hooks stubbed) renders its "Add a team" card rather than redirecting.
    await waitFor(() => {
      expect(screen.getByText('Add a team')).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/admin')
  })
})

describe('every route is wrapped by the wrapper its guard level names', () => {
  const concrete = (path: string): string =>
    path === '*'
      ? '/some-unknown-path'
      : path.replace(':id', UUID).replace(':token', TOKEN).replace(':teamId', UUID)

  it.each(routeTable.map((r) => [r.path, r.guard] as const))(
    'a signed-out visitor to %s (guard: %s) is treated per its guard',
    async (path, guard) => {
      hoisted.account.value = { status: 'signedOut' }
      const target = concrete(path)
      const router = mount(target)
      if (guard === 'public') {
        // Public routes render without a session at their own path — never bounced to /login (AC7).
        await waitFor(() => {
          expect(router.state.location.pathname).toBe(target)
        })
      } else {
        // Every authed/manager/admin route sits under RequireAuth, so it redirects (AC6).
        await waitFor(() => {
          expect(router.state.location.pathname).toBe('/login')
        })
      }
    },
  )
})
