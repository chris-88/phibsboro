import type { ComponentType } from 'react'
import type { RouteObject } from 'react-router'
import { RootHydrateFallback, RootLayout } from '@/components/root-layout'
import { NotFound } from '@/components/not-found'
import { loadChunk } from '@/lib/chunk-reload'
import { RouteError } from '@/components/route-error'
import { RequireAdmin, RequireAuth, RequireManager } from '@/features/auth/guards'
import HistoryScreen from '@/features/attendance/routes/HistoryScreen'
import JoinByTokenScreen from '@/features/teams/JoinByTokenScreen'
import LoginScreen from '@/features/auth/login-screen'
import RegisterScreen from '@/features/auth/register-screen'
import ResetScreen from '@/features/auth/ResetPasswordScreen'
import EventScreen from '@/features/events/routes/EventDetailScreen'
import HomeScreen from '@/features/events/routes/HomeScreen'
import { NOT_FOUND_TITLE } from '@/lib/document-title'
import { paths } from '@/lib/paths'
import type { AppRouteMeta } from '@/lib/route-meta'

export type { AppRouteMeta, GuardLevel } from '@/lib/route-meta'

import type { GuardLevel } from '@/lib/route-meta'

/**
 * Guard level to the wrapper that enforces it. Declared once, applied where the route objects
 * are built, so a route cannot be guarded by accident or left unguarded by omission (S2.9). The
 * wrappers are convenience; RLS is the enforcement layer (S1.3, proved by S1.4).
 */
const GUARDS: Record<GuardLevel, (el: React.ReactNode) => React.ReactNode> = {
  public: (el) => el,
  authed: (el) => <RequireAuth>{el}</RequireAuth>,
  manager: (el) => (
    <RequireAuth>
      <RequireManager>{el}</RequireManager>
    </RequireAuth>
  ),
  admin: (el) => (
    <RequireAuth>
      <RequireAdmin>{el}</RequireAdmin>
    </RequireAuth>
  ),
}

type Screen =
  /** In the entry chunk. The player journey is measured in seconds on a car-park connection. */
  | { element: React.JSX.Element }
  /** Its own chunk. A player's phone never downloads the manager or admin screens (AC12). */
  | { lazy: () => Promise<{ default: ComponentType }> }

export type AppRoute = AppRouteMeta & { screen: Screen }

/**
 * The one route table (D34). Chrome per D41: deep-link targets are `bare` so the YES / NO
 * buttons are never under the nav; `/login` and the 404 are `bare` too because neither has
 * anywhere to navigate to. Guard levels are declared here and enforced by S2.9.
 */
export const routeTable: readonly AppRoute[] = [
  {
    path: paths.home(),
    chrome: 'nav',
    guard: 'authed',
    title: 'Home',
    screen: { element: <HomeScreen /> },
  },
  {
    path: paths.login(),
    chrome: 'bare',
    guard: 'public',
    title: 'Sign in',
    screen: { element: <LoginScreen /> },
  },
  {
    path: paths.register(),
    chrome: 'bare',
    guard: 'public',
    title: 'Register',
    screen: { element: <RegisterScreen /> },
  },
  {
    path: '/join/:token',
    chrome: 'bare',
    guard: 'public',
    title: 'Join team',
    screen: { element: <JoinByTokenScreen /> },
  },
  {
    path: '/reset/:token',
    chrome: 'bare',
    guard: 'public',
    title: 'Set password',
    screen: { element: <ResetScreen /> },
  },
  // Public on purpose: a stranger arriving cold from WhatsApp must see the event (D6, D7).
  {
    path: '/event/:id',
    chrome: 'bare',
    guard: 'public',
    title: 'Event',
    screen: { element: <EventScreen /> },
  },
  {
    path: paths.history(),
    chrome: 'nav',
    guard: 'authed',
    title: 'History',
    screen: { element: <HistoryScreen /> },
  },
  {
    path: paths.manage(),
    chrome: 'nav',
    guard: 'manager',
    title: 'Manage',
    screen: { lazy: () => import('@/features/events/manage-screen') },
  },
  {
    path: paths.newEvent(),
    chrome: 'nav',
    guard: 'manager',
    title: 'New event',
    screen: { lazy: () => import('@/features/events/new-event-screen') },
  },
  {
    path: '/manage/event/:id',
    chrome: 'nav',
    guard: 'manager',
    title: 'Manage event',
    screen: { lazy: () => import('@/features/events/manage-event-screen') },
  },
  {
    path: '/manage/team/:teamId/members',
    chrome: 'nav',
    guard: 'manager',
    title: 'Members',
    screen: { lazy: () => import('@/features/teams/team-members-screen') },
  },
  {
    path: paths.squad(),
    chrome: 'nav',
    guard: 'manager',
    title: 'Squad',
    screen: { lazy: () => import('@/features/teams/squad-screen') },
  },
  {
    path: paths.admin(),
    chrome: 'nav',
    guard: 'admin',
    title: 'Admin',
    screen: { lazy: () => import('@/features/teams/admin-screen') },
  },
  {
    path: '*',
    chrome: 'bare',
    guard: 'public',
    title: NOT_FOUND_TITLE,
    screen: { element: <NotFound /> },
  },
]

function toRouteObject(route: AppRoute): RouteObject {
  const { screen, ...handle } = route
  const shared = { handle } satisfies Pick<RouteObject, 'handle'>
  const guard = GUARDS[route.guard]
  const target =
    'element' in screen
      ? { element: guard(screen.element) }
      : {
          // Wrap inside the lazy callback, so a lazily loaded manager or admin chunk is still
          // guarded (S2.9). The guard wrappers are eager, so the chunk downloads only after the
          // guard admits the viewer.
          lazy: async () => {
            // loadChunk reloads once if the chunk is stale after a deploy, instead of hanging.
            const Screen = (await loadChunk(screen.lazy)).default
            return { Component: () => <>{guard(<Screen />)}</> }
          },
        }
  // The root is `/`, so its index route is the home screen rather than a child at `/`.
  return route.path === '/'
    ? { index: true, ...shared, ...target }
    : { path: route.path, ...shared, ...target }
}

/** Router-agnostic, so tests mount it in a memory router and `main.tsx` in a hash router. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    HydrateFallback: RootHydrateFallback,
    children: routeTable.map(toRouteObject),
  },
]
