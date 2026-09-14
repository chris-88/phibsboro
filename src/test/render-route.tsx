import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import type { Session } from '@supabase/supabase-js'
import { routes } from '@/routes'
import { SessionContext, type SessionState } from '@/features/auth/session-context'
import { clearPendingJoin, setPendingJoin, type PendingJoin } from '@/features/auth/pending-join'
import type { CurrentUser, CurrentUserState } from '@/features/auth/use-current-user'
import type { SupabaseStub } from '@/test/supabase-stub'
import { stubSupabase, type Fixtures, type Scenario } from '@/test/supabase-stub'
import { fakeUser } from '@/test/fixtures'

/**
 * The harness renderer for the S7.1 state audit. It mounts the real route table (`@/routes`) in a
 * memory router, inside a fresh `QueryClient` (`retry: false`, `gcTime: 0`) so a populated cache
 * never leaks into the loading case, and a `SessionContext` set to the case's session. `@/lib/supabase`
 * and `@/features/auth/use-current-user` are mocked by the test file through the shared `control`
 * object, which this renderer writes before each render — see `states.test.tsx`.
 */

export type Role = 'player' | 'manager' | 'admin'

/** The mutable seam the test file's `vi.mock` factories forward to. */
export interface HarnessControl {
  stub: SupabaseStub
  userState: CurrentUserState
}

export interface RenderRouteOptions {
  scenario: Scenario
  /** The one source the scenario applies to; every other source stays populated. */
  driver?: string
  fixtures?: Fixtures
  /** Who the router is signed in as. Omit for a signed-out visitor. */
  role?: Role
  /** Force the session/account into the restoring state (for the login skeleton). */
  loading?: boolean
  /** Seeded before mount so a token- or event-scoped screen reads it (register, join). */
  pendingJoin?: PendingJoin
  /** Bumped whenever the driver source issues a request; a test proves Retry refetches with it. */
  onRequest?: (source: string) => void
}

function sessionFor(role: Role | undefined, loading: boolean): SessionState {
  if (loading) return { status: 'loading', session: null }
  if (!role) return { status: 'signedOut', session: null }
  const user = fakeUser(role)
  return { status: 'signedIn', session: { user: { id: user.id } } as Session }
}

function userStateFor(role: Role | undefined, loading: boolean): CurrentUserState {
  if (loading) return { status: 'loading' }
  if (!role) return { status: 'signedOut' }
  const user: CurrentUser = fakeUser(role)
  return { status: 'ready', user }
}

export function createRenderRoute(control: HarnessControl) {
  return function renderRoute(path: string, opts: RenderRouteOptions): RenderResult {
    control.stub = stubSupabase({
      scenario: opts.scenario,
      fixtures: opts.fixtures ?? {},
      driver: opts.driver,
      onRequest: opts.onRequest,
    })
    control.userState = userStateFor(opts.role, opts.loading ?? false)

    clearPendingJoin()
    if (opts.pendingJoin) setPendingJoin(opts.pendingJoin)

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    })
    const router = createMemoryRouter(routes, { initialEntries: [path] })

    return render(
      <QueryClientProvider client={client}>
        <SessionContext.Provider value={sessionFor(opts.role, opts.loading ?? false)}>
          <RouterProvider router={router} />
        </SessionContext.Provider>
      </QueryClientProvider>,
    )
  }
}
