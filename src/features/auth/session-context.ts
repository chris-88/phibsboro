import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import { queryClient } from '@/api/queryClient'
import { clearPendingJoin } from '@/features/auth/pending-join'
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
 * Empties the client's view of the signed-out user: the query cache, the Sentry identity, and the
 * pending join (S2.1's key). Both the deliberate sign-out (S2.9 `useSignOut`) and an involuntary
 * `SIGNED_OUT` from a refresh failure call it, so no signed-in user's data survives into the next
 * sign-in on the same device (AC11). The intended route is handled by each caller, because its fate
 * differs: a deliberate sign-out clears it, an expiry keeps it (AC10).
 */
export function tearDownSession(): void {
  queryClient.clear()
  setSentryUser(null)
  clearPendingJoin()
}
