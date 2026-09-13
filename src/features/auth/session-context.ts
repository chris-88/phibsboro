import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import { queryClient } from '@/api/queryClient'
import { setSentryUser } from '@/lib/sentry'

/**
 * The auth session as three states, so no screen has to guess whether auth is still restoring.
 * `loading` is the initial state and holds only until `getSession()` settles, which is what AC8
 * (no login flash) rests on. This is the vocabulary S2.6 and S2.5 build on.
 *
 * The context, the hook and the teardown live here rather than in `session-provider.tsx` so that
 * file exports only its component (the fast-refresh boundary). The one auth subscription still
 * lives solely in `session-provider.tsx` (AC16).
 */
export type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'signedOut'; session: null }
  | { status: 'signedIn'; session: Session }

export const SessionContext = createContext<SessionState>({ status: 'loading', session: null })

export function useSession(): SessionState {
  return useContext(SessionContext)
}

/**
 * Empties the client's view of the signed-out user: the query cache and the Sentry identity.
 * Both the deliberate sign-out (S2.9 `useSignOut`) and an involuntary `SIGNED_OUT` from a refresh
 * failure call it, so the teardown lives in one place (AC11). S2.6 extends it.
 */
export function tearDownSession(): void {
  queryClient.clear()
  setSentryUser(null)
}
