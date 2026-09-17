import { useEffect } from 'react'
import { Outlet, ScrollRestoration, useLocation, useMatches, useNavigate } from 'react-router'
import { AppShell, AppShellSkeleton } from '@/components/app-shell'
import { LoadingState } from '@/components/states'
import { SessionInvalidError } from '@/api/current-user'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { useLastSeen } from '@/features/auth/use-last-seen'
import { SubsReminderModal } from '@/features/subs/components/SubsReminderModal'
import { supabase } from '@/lib/supabase'
import { PendingJoinGate } from '@/features/teams/PendingJoinGate'
import { NOT_FOUND_TITLE, useDocumentTitle } from '@/lib/document-title'
import type { AppRole } from '@/lib/nav'
import { paths } from '@/lib/paths'
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
  // The resume overlay sits outside the shell (no nav, no back) and above the routed content, so a
  // pending join finishes before any screen renders — the S2.6 order S2.5 builds on (S2.4).
  return (
    <PendingJoinGate>
      <RoutedShell />
    </PendingJoinGate>
  )
}

function RoutedShell(): React.JSX.Element {
  const meta = useRouteMeta()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  // A session whose account was deleted (a removed member, or a reseed) loads a valid-looking
  // token but no profile. Rather than hang on the skeleton or offer a retry that can never
  // succeed, sign out — SessionProvider then routes to /login with the "signed out" notice and
  // remembers the intended route (S2.6). Guarded so it fires once per resolved dead session.
  const deadSession = user.status === 'error' && user.error instanceof SessionInvalidError
  useEffect(() => {
    if (deadSession) void supabase.auth.signOut()
  }, [deadSession])
  // S18.6: stamp last-active for a signed-in user, throttled — the admin Users screen reads it.
  useLastSeen(user.status === 'ready', pathname)
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

  // A bare screen is a deep-link target: a WhatsApp tap opens it cold with no in-app history, so
  // "back" must go home rather than out of the SPA. React Router writes `idx` into history state,
  // which is 0 on a cold arrival and grows with in-app navigation (S3.3 AC16, D41).
  const onBack =
    chrome === 'bare'
      ? () => {
          const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
          if (idx > 0) void navigate(-1)
          else void navigate(paths.home())
        }
      : undefined

  return (
    <>
      <ScrollRestoration />
      {/* Bare screens own their heading — the 404 and the event card carry their own — so
          the header there is the back affordance alone. */}
      <AppShell
        chrome={chrome}
        role={role}
        title={chrome === 'nav' ? meta?.title : undefined}
        onBack={onBack}
        currentPath={pathname}
      >
        <Outlet />
      </AppShell>
      {/* S19.3: a signed-in member who owes subs gets a once-a-session reminder over any screen. */}
      {user.status === 'ready' && <SubsReminderModal />}
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
