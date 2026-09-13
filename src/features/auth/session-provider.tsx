import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { queryClient } from '@/api/queryClient'
import { userKeys } from '@/api/queryKeys'
import { SessionContext, tearDownSession, type SessionState } from '@/features/auth/session-context'
import { setSentryUser } from '@/lib/sentry'
import { supabase } from '@/lib/supabase'

/**
 * The app's single auth-state subscription (AC16): a grep for the subscribe call returns exactly
 * this file. Mounted above the router in `App`, inside the query provider so the current-user
 * query has its client. It calls `getSession()` once to leave `loading`, then
 * reacts to auth events. S2.6 wraps it with the splash gate and the long-background handling; S2.5
 * adds the route restore inside the router. `useSession`, `SessionState` and `tearDownSession`
 * live in `session-context.ts`.
 */
export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null })

  useEffect(() => {
    let active = true

    const apply = (session: Session | null): void => {
      if (!active) return
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut', session: null })
    }

    void supabase.auth.getSession().then(({ data }) => {
      apply(data.session)
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
          // A new access token, same user. S2.6 owns refresh; nothing else changes here.
          apply(session)
          break
        case 'USER_UPDATED':
          apply(session)
          void queryClient.invalidateQueries({ queryKey: userKeys.current() })
          break
        case 'SIGNED_OUT':
          if (active) setState({ status: 'signedOut', session: null })
          tearDownSession()
          break
        default:
          break
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}
