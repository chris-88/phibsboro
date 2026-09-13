import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { queryClient } from '@/api/queryClient'
import { userKeys } from '@/api/queryKeys'
import { consumeSignOutRequested } from '@/features/auth/sign-out-intent'
import { setExpiryNotice } from '@/features/auth/expiry-notice'
import { SessionContext, tearDownSession, type SessionState } from '@/features/auth/session-context'
import { currentHashPath, router } from '@/app/router'
import { clearIntendedRoute, setIntendedRoute } from '@/lib/intended-route'
import { paths } from '@/lib/paths'
import { setSentryUser } from '@/lib/sentry'
import { supabase } from '@/lib/supabase'

/** A rapid hide/show must not fire two `getSession()` calls (AC12). */
const RESUME_DEBOUNCE_MS = 250

/**
 * Why a `SIGNED_OUT` fired, and what the player is owed as a result. GoTrue raises one event for
 * both a deliberate sign-out and a genuine refresh failure; `consumeSignOutRequested()` tells them
 * apart (AC10).
 */
function teardownForSignOut(): void {
  const deliberate = consumeSignOutRequested()
  // Cache, Sentry identity and the pending join go on both paths (AC11).
  tearDownSession()
  if (deliberate) {
    // The user asked. There is nowhere to return to.
    clearIntendedRoute()
  } else {
    // The refresh token genuinely expired (or a manager reset the password, D10). Remember where
    // they were so S2.5 returns them after the next sign-in, and carry the one-line notice (AC10).
    setIntendedRoute(currentHashPath())
    setExpiryNotice()
  }
  // Not `useNavigate`: this runs in the auth subscription, above the router (D59).
  void router.navigate(paths.login(), { replace: true })
}

/**
 * The app's single auth-state subscription (AC8): a grep for `onAuthStateChange` returns exactly
 * this file. Mounted above the router by `AppBoot`, inside the query provider so the current-user
 * query has its client. It calls `getSession()` once to leave `loading`, then reacts to auth
 * events; the client itself owns the silent refresh (`autoRefreshToken`, D59), so there is no
 * timer here. On a resume from a long background it asks the client for the session once, before
 * any refetch, so no screen renders an auth error a refresh would have fixed (AC12).
 *
 * Never starts at `signedOut`: an optimistic signed-out start is the login flash AC7 forbids.
 */
export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null })

  useEffect(() => {
    let active = true

    const apply = (session: Session | null): void => {
      if (!active) return
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null })
    }

    // One read to leave `loading`. A rejection — offline at cold start — resolves to `signedOut`
    // rather than hanging the splash; the router then renders `/login` with its own offline line.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        apply(data.session)
      })
      .catch(() => {
        apply(null)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case 'INITIAL_SESSION':
        case 'SIGNED_IN':
          apply(session)
          if (session) setSentryUser(session.user.id)
          break
        case 'TOKEN_REFRESHED':
          // A new access token, same user: the silent refresh AC5 rests on. Nothing else changes.
          apply(session)
          break
        case 'USER_UPDATED':
          apply(session)
          void queryClient.invalidateQueries({ queryKey: userKeys.current() })
          break
        case 'SIGNED_OUT':
          if (active) setState({ status: 'signedOut', session: null })
          teardownForSignOut()
          break
        default:
          break
      }
    })

    // Long background: on returning to the tab (or reopening the installed PWA), ask the client for
    // the session once so it refreshes an expired token before TanStack Query's focus refetch races
    // it. Debounced, so a rapid hide/show is a single call (AC12).
    let resumeTimer: ReturnType<typeof setTimeout> | undefined
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return
      if (resumeTimer) clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => {
        void supabase.auth.getSession()
      }, RESUME_DEBOUNCE_MS)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      if (resumeTimer) clearTimeout(resumeTimer)
      document.removeEventListener('visibilitychange', onVisible)
      subscription.unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}
