import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { takeIntendedRoute } from '@/lib/intended-route'

/**
 * The cold-start half of the deep-link return path (S2.5). The warm path is `nextRouteAfterAuth()`
 * in a form submit; this is the case a form never touches — a session restored on relaunch, or a
 * pending join (S2.4) resumed on boot, with an intended route still stored. It reads the route,
 * validates and consumes it, and navigates once.
 *
 * `enabled` is the boot ordering made a boolean: true only once the session has settled off
 * `loading` and the pending join has reached `done`, so the deep-linked event renders as a member
 * rather than the preview (AC7). While the user is signed out it stays false and the hook does
 * nothing — an anonymous visitor sitting on `/event/:id` keeps their destination if they wander to
 * `/login`.
 *
 * Runs its navigate exactly once per mount (a `useRef` guards React's strict-mode double effect;
 * `takeIntendedRoute` clearing on read guards against the warm path having already consumed it).
 * `replace: true` so the back button does not walk the user back into the registration form. It
 * uses `useNavigate()`, so it must be mounted from the router root, never a provider above it.
 */
export function useIntendedRoute(enabled: boolean): void {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const consumed = useRef(false)

  useEffect(() => {
    if (!enabled || consumed.current) return
    consumed.current = true
    const target = takeIntendedRoute()
    // Nothing stored, or already there: leave the URL exactly as it is (AC8, AC12).
    if (target !== null && target !== pathname) {
      void navigate(target, { replace: true })
    }
  }, [enabled, navigate, pathname])
}
