import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * The lightweight last-active heartbeat (S18.6). While a signed-in user moves around the app, this
 * stamps `profiles.last_seen_at` through `touch_last_seen()` — but at most once every few minutes,
 * tracked in `localStorage`, so it is one cheap single-row update rather than a write per tap. It
 * fires on mount, on each navigation, and when the tab is brought back to the foreground. Purely
 * best-effort: every failure is swallowed (it is telemetry, never part of a user flow).
 */
const THROTTLE_MS = 5 * 60 * 1000
const KEY = 'pfc.lastSeenTouch'

function due(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? '0') >= THROTTLE_MS
  } catch {
    // No storage (private mode): touch every time rather than never; still throttled by nav pace.
    return true
  }
}

function touch(): void {
  if (!due()) return
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Ignore: worst case we touch again next navigation.
  }
  // Zero-arg RPC: gen-types types Args as `never`, so call it directly. The PostgREST builder is
  // lazy — it only sends the request when awaited or `.then()`-ed — so `.then()` is what actually
  // fires it; both handlers no-op because this is best-effort telemetry, never part of a flow.
  void supabase.rpc('touch_last_seen').then(
    () => undefined,
    () => undefined,
  )
}

/**
 * @param active True only for a resolved, signed-in user — public/cold routes never touch.
 * @param pathname The current route, so a navigation re-runs the (throttled) touch.
 */
export function useLastSeen(active: boolean, pathname: string): void {
  // On mount and on every navigation (throttled inside `touch`).
  useEffect(() => {
    if (active) touch()
  }, [active, pathname])

  // And when the tab returns to the foreground, so a user who left it open still stamps on return.
  useEffect(() => {
    if (!active) return
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') touch()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])
}
