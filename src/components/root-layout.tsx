import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router'
import { AppShell, AppShellSkeleton } from '@/components/app-shell'
import { LoadingState } from '@/components/states'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { NOT_FOUND_TITLE, useDocumentTitle } from '@/lib/document-title'
import type { AppRole } from '@/lib/nav'
import { type AppRouteMeta, type GuardLevel, isAppRouteMeta } from '@/lib/route-meta'

/** The deepest match carrying route metadata. Every route in the table has one. */
function useRouteMeta(): AppRouteMeta | undefined {
  const matches = useMatches()
  for (let i = matches.length - 1; i >= 0; i--) {
    const handle = matches[i]?.handle
    if (isAppRouteMeta(handle)) return handle
  }
  return undefined
}

/** The single shell around every route: chrome from the route table (D41), the document
 *  title from the same row (AC13), and scroll reset on navigation (AC14). The nav's role comes
 *  from the signed-in user (S2.9). Convenience only; RLS is the boundary. */
export function RootLayout(): React.JSX.Element {
  const meta = useRouteMeta()
  const { pathname } = useLocation()
  const user = useCurrentUser()
  const chrome = meta?.chrome ?? 'bare'
  const guard: GuardLevel = meta?.guard ?? 'public'
  useDocumentTitle(meta?.title ?? NOT_FOUND_TITLE)

  // A guarded route waits for the account before rendering chrome that depends on role: the
  // skeleton keeps the nav's height, so there is no flash of the login screen (AC8). Public
  // routes render regardless of session — a cold WhatsApp arrival is never gated (AC7).
  if (guard !== 'public' && user.status === 'loading') {
    return <AppShellSkeleton />
  }

  // Convenience only. RLS is the enforcement layer (S1.3, proved by S1.4). 'player' is the safe
  // floor before the account resolves and on the error path.
  const role: AppRole =
    user.status === 'ready'
      ? user.user.isAdmin
        ? 'admin'
        : user.user.isManagerOfAny
          ? 'manager'
          : 'player'
      : 'player'

  return (
    <>
      <ScrollRestoration />
      {/* Bare screens own their heading — the 404 and the event card carry their own — so
          the header there is the back affordance alone. */}
      <AppShell
        chrome={chrome}
        role={role}
        title={chrome === 'nav' ? meta?.title : undefined}
        currentPath={pathname}
      >
        <Outlet />
      </AppShell>
    </>
  )
}

/** Shown while a lazy chunk resolves on a cold load of a manager or admin route. All lazy
 *  routes are `nav` chrome, so the shell shape is right before the chunk arrives. */
export function RootHydrateFallback(): React.JSX.Element {
  return (
    <AppShell chrome="nav" role="player" currentPath="/">
      <div className="py-6">
        <LoadingState />
      </div>
    </AppShell>
  )
}
