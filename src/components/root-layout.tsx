import { Outlet, ScrollRestoration, useLocation, useMatches } from 'react-router'
import { AppShell } from '@/components/app-shell'
import { LoadingState } from '@/components/states'
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

// Until S2.9 supplies the real role from useCurrentUser(), the nav shows the items the
// route's guard level implies, so a manager placeholder has a Manage tab to be active on.
// Presentation only; RLS is the boundary.
function roleForGuard(guard: GuardLevel): AppRole {
  if (guard === 'admin') return 'admin'
  if (guard === 'manager') return 'manager'
  return 'player'
}

/** The single shell around every route: chrome from the route table (D41), the document
 *  title from the same row (AC13), and scroll reset on navigation (AC14). */
export function RootLayout(): React.JSX.Element {
  const meta = useRouteMeta()
  const { pathname } = useLocation()
  const chrome = meta?.chrome ?? 'bare'
  useDocumentTitle(meta?.title ?? NOT_FOUND_TITLE)

  return (
    <>
      <ScrollRestoration />
      {/* Bare screens own their heading — the 404 and the event card carry their own — so
          the header there is the back affordance alone. */}
      <AppShell
        chrome={chrome}
        role={roleForGuard(meta?.guard ?? 'public')}
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
