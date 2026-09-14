import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as fx from '@/test/fixtures'
import type { HarnessControl, RenderRouteOptions } from '@/test/render-route'

/**
 * S7.1 AC2–AC4. Mounts every route in `route-manifest.ts` in each of its four states through the
 * real route table and the real `src/api/` hooks, against a stubbed Supabase client. A route
 * missing a documented state fails here, not in review.
 *
 * `useCurrentUser`/`useSignedInUser` and `@/lib/supabase` are the two seams the harness controls,
 * both forwarded to the hoisted `control` object below and rewritten by `renderRoute` per render.
 * Server-read screens are driven through all four states (loading skeleton, empty copy, error line
 * with a Retry that issues a second request, populated content). The form/token screens whose
 * error is a submit failure (login bad password, register/reset dead link) are proven in their own
 * story tests, cited in `docs/state-coverage.md`; here they are mounted in the states the harness
 * can reach without driving a submit.
 */

const control = vi.hoisted((): { stub: Record<string, unknown>; userState: unknown } => ({
  stub: {},
  userState: { status: 'signedOut' },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get: (_t, prop: string | symbol) =>
        typeof prop === 'string' ? control.stub[prop] : undefined,
    },
  ),
}))

vi.mock('@/features/auth/use-current-user', () => ({
  useCurrentUser: () => control.userState,
  useSignedInUser: () => {
    const s = control.userState as { status: string; user?: unknown }
    if (s.status !== 'ready') throw new Error(`useSignedInUser not ready: ${s.status}`)
    return s.user
  },
}))

const { createRenderRoute } = await import('@/test/render-route')
const { useManageStore } = await import('@/features/teams/manageStore')
const renderRoute = createRenderRoute(control as unknown as HarnessControl)

beforeEach(() => {
  localStorage.clear()
  useManageStore.setState({ selectedTeamId: null })
})

/** No route renders an empty body, and none falls through to the router error boundary (AC3, AC4). */
function expectHealthy(container: HTMLElement): void {
  expect(container.childElementCount).toBeGreaterThan(0)
  // The S0.6 error boundary's own line; its presence would mean a screen threw instead of
  // rendering its designed error state.
  expect(screen.queryByText('Try again, or go back to the app.')).not.toBeInTheDocument()
}

/** Renders the error scenario, waits for the inline line, then proves the Retry issues a second
 *  request to the same source (AC3). */
async function expectRetryRefetches(
  path: string,
  opts: Omit<RenderRouteOptions, 'scenario' | 'onRequest'>,
  errorText: string | RegExp,
): Promise<void> {
  const driver = opts.driver
  let requests = 0
  const { container } = renderRoute(path, {
    ...opts,
    scenario: 'error',
    onRequest: (source) => {
      if (source === driver) requests += 1
    },
  })
  await screen.findByText(errorText)
  expectHealthy(container)
  const before = requests
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await waitFor(() => {
    expect(requests).toBeGreaterThan(before)
  })
}

// —————————————————————————————————————— Player ——————————————————————————————————

describe('/ (home) — S3.1', () => {
  const opts = {
    role: 'player',
    driver: 'events',
    fixtures: { events: fx.upcomingEventRows },
  } as const

  it('loading: skeleton next-event card', async () => {
    const { container } = renderRoute('/', { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('empty: "Nothing coming up."', async () => {
    const { container } = renderRoute('/', { ...opts, scenario: 'empty' })
    expect(await screen.findByText('Nothing coming up.')).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches('/', opts, "Couldn't load your events.")
  })

  it('populated: the next-event card', async () => {
    const { container } = renderRoute('/', { ...opts, scenario: 'populated' })
    expect(await screen.findByRole('heading', { name: 'Firsts v Shelbourne' })).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/event/:id — S3.3', () => {
  const path = `/event/${fx.ids.event}`
  const opts = {
    role: 'player',
    driver: 'events',
    fixtures: { events: [fx.eventDetailRow] },
  } as const

  it('loading: skeleton header and disabled controls', async () => {
    const { container } = renderRoute(path, { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches(path, opts, "Couldn't load this event.")
  })

  it('populated: full event and YES / NO', async () => {
    const { container } = renderRoute(path, { ...opts, scenario: 'populated' })
    expect(await screen.findByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Firsts v Shelbourne' })).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/history — S3.5', () => {
  const opts = {
    role: 'player',
    driver: 'events',
    fixtures: { events: fx.historyEventRows },
  } as const

  it('loading: skeleton list', async () => {
    const { container } = renderRoute('/history', { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('status', { name: 'Loading history' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('empty: "No past events yet."', async () => {
    const { container } = renderRoute('/history', { ...opts, scenario: 'empty' })
    expect(await screen.findByText('No past events yet.')).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches('/history', opts, "Couldn't load your history.")
  })

  it('populated: past events with status', async () => {
    const { container } = renderRoute('/history', { ...opts, scenario: 'populated' })
    expect(await screen.findByText('Tuesday training')).toBeInTheDocument()
    expectHealthy(container)
  })
})

// —————————————————————————————————————— Auth / token ————————————————————————————

describe('/login — S2.2', () => {
  it('loading: session restoring, no form flash', async () => {
    const { container } = renderRoute('/login', { scenario: 'populated', loading: true })
    await waitFor(() => {
      expect(container.childElementCount).toBeGreaterThan(0)
    })
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
    expectHealthy(container)
  })

  it('populated: number and password fields', async () => {
    const { container } = renderRoute('/login', { scenario: 'populated' })
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/register — S2.1', () => {
  const opts = {
    driver: 'rpc:lookup_team_invite',
    fixtures: { 'rpc:lookup_team_invite': fx.inviteLookupRows },
    pendingJoin: { kind: 'token', token: 'seed-token' },
  } as const

  it('loading: skeleton while the token is validated', async () => {
    const { container } = renderRoute('/register', { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: invalid-link check with a Retry that refetches', async () => {
    await expectRetryRefetches('/register', opts, "Couldn't check that link.")
  })

  it('populated: name, number, password', async () => {
    const { container } = renderRoute('/register', { ...opts, scenario: 'populated' })
    expect(await screen.findByText(/You.?re joining/)).toBeInTheDocument()
    expect(screen.getByText('Firsts')).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/join/:token — S2.4', () => {
  const path = '/join/seed-token'
  const opts = {
    driver: 'rpc:lookup_team_invite',
    fixtures: { 'rpc:lookup_team_invite': fx.inviteLookupRows },
  } as const

  it('loading: "Checking your link"', async () => {
    const { container } = renderRoute(path, { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('status', { name: 'Checking your link' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches(path, opts, "Couldn't check that link.")
  })

  it('populated: team name and a single Join button', async () => {
    const { container } = renderRoute(path, { ...opts, scenario: 'populated' })
    expect(await screen.findByRole('button', { name: /Join Firsts/ })).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/reset/:token — S2.3', () => {
  it('populated: new-password field and Save', async () => {
    const { container } = renderRoute('/reset/seed-token', { scenario: 'populated' })
    expect(await screen.findByRole('heading', { name: 'Pick a new password' })).toBeInTheDocument()
    expectHealthy(container)
  })
})

// —————————————————————————————————————— Manager ————————————————————————————————

describe('/manage — S4.1', () => {
  const opts = {
    role: 'manager',
    driver: 'events',
    fixtures: { teams: fx.teamRows, events: fx.teamEventRows },
  } as const

  it('loading: skeleton list', async () => {
    const { container } = renderRoute('/manage', { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('status', { name: 'Loading events' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('empty: "No events yet." plus Create event', async () => {
    const { container } = renderRoute('/manage', { ...opts, scenario: 'empty' })
    expect(await screen.findByText('No events yet.')).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches('/manage', opts, "Couldn't load your events.")
  })

  it('populated: the team events', async () => {
    const { container } = renderRoute('/manage', { ...opts, scenario: 'populated' })
    expect(await screen.findByText('Firsts v Shelbourne')).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/manage/event/new — S4.1', () => {
  const opts = { role: 'manager', driver: 'teams', fixtures: { teams: fx.teamRows } } as const

  it('loading: skeleton while the team resolves', async () => {
    const { container } = renderRoute('/manage/event/new', { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches('/manage/event/new', opts, "Couldn't load teams.")
  })

  it('populated: the create form', async () => {
    const { container } = renderRoute('/manage/event/new', { ...opts, scenario: 'populated' })
    expect(await screen.findByRole('button', { name: 'Add event' })).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/manage/event/:id — S4.3', () => {
  const path = `/manage/event/${fx.ids.event}`
  const fixtures = {
    events: [fx.eventDetailRow],
    'rpc:team_member_directory': fx.memberRows,
    event_responses: fx.responseRows,
    attendance: fx.attendanceRows,
  }

  it('loading: skeleton header and counts', async () => {
    const { container } = renderRoute(path, {
      role: 'manager',
      driver: 'events',
      fixtures,
      scenario: 'loading',
    })
    expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('empty: "No one has joined this team yet"', async () => {
    const { container } = renderRoute(path, {
      role: 'manager',
      driver: 'rpc:team_member_directory',
      fixtures,
      scenario: 'empty',
    })
    expect(await screen.findByText('No one has joined this team yet.')).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches(
      path,
      { role: 'manager', driver: 'events', fixtures },
      "Couldn't load that event.",
    )
  })

  it('populated: header, counts, response list', async () => {
    const { container } = renderRoute(path, {
      role: 'manager',
      driver: 'events',
      fixtures,
      scenario: 'populated',
    })
    expect(await screen.findByText('Firsts v Shelbourne')).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/manage/team/:teamId/members — S6.4', () => {
  const path = `/manage/team/${fx.ids.team}/members`
  const opts = {
    role: 'manager',
    driver: 'rpc:team_member_directory',
    fixtures: {
      'rpc:team_member_directory': fx.memberRows,
      teams: fx.teamRows,
      'rpc:get_team_invite': fx.teamInviteViewRows,
    },
  } as const

  it('loading: skeleton rows below the join-link panel', async () => {
    const { container } = renderRoute(path, { ...opts, scenario: 'loading' })
    expect(await screen.findByText('Join link')).toBeInTheDocument()
    expect(screen.queryByText('No one has joined this team yet.')).not.toBeInTheDocument()
    expect(screen.queryByText("Couldn't load the squad.")).not.toBeInTheDocument()
    expectHealthy(container)
  })

  it('empty: "No one has joined this team yet"', async () => {
    const { container } = renderRoute(path, { ...opts, scenario: 'empty' })
    expect(await screen.findByText('No one has joined this team yet.')).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches(path, opts, "Couldn't load the squad.")
  })

  it('populated: the squad', async () => {
    const { container } = renderRoute(path, { ...opts, scenario: 'populated' })
    expect(await screen.findByText('Mel Manager')).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('/admin — S6.1', () => {
  const opts = { role: 'admin', driver: 'teams', fixtures: { teams: fx.teamRows } } as const

  it('loading: skeleton list', async () => {
    const { container } = renderRoute('/admin', { ...opts, scenario: 'loading' })
    expect(await screen.findByRole('status', { name: 'Loading teams' })).toBeInTheDocument()
    expectHealthy(container)
  })

  it('empty: "No teams yet."', async () => {
    const { container } = renderRoute('/admin', { ...opts, scenario: 'empty' })
    expect(await screen.findByText('No teams yet.')).toBeInTheDocument()
    expectHealthy(container)
  })

  it('error: inline line and a Retry that refetches', async () => {
    await expectRetryRefetches('/admin', opts, "Couldn't load teams.")
  })

  it('populated: active teams', async () => {
    const { container } = renderRoute('/admin', { ...opts, scenario: 'populated' })
    expect(await screen.findByText('Firsts')).toBeInTheDocument()
    expectHealthy(container)
  })
})

describe('404', () => {
  it('populated: a plain message and a link home', async () => {
    const { container } = renderRoute('/no-such-route', { scenario: 'populated' })
    expect(await screen.findByText('Nothing here.')).toBeInTheDocument()
    expectHealthy(container)
  })
})
