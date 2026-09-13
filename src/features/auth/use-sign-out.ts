import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { tearDownSession } from '@/features/auth/session-context'
import { markSignOutRequested } from '@/features/auth/sign-out-intent'
import { clearIntendedRoute } from '@/lib/intended-route'
import { paths } from '@/lib/paths'
import { supabase } from '@/lib/supabase'

/**
 * The only account affordance in v1 (Q11). Signs out, then runs the local teardown and lands
 * on `/login` (AC11). A `signOut()` that rejects still tears down locally — the shared
 * `tearDownSession` also runs on an involuntary `SIGNED_OUT`, so the cache and identity are
 * cleared on both paths — and surfaces a toast rather than trapping the user in a half-signed
 * state. S2.6 extends the teardown with `pfc.pendingJoin`.
 */
export function useSignOut(): { signOut: () => Promise<void>; isPending: boolean } {
  const navigate = useNavigate()
  const [isPending, setIsPending] = useState(false)

  const signOut = async (): Promise<void> => {
    setIsPending(true)
    // Set before signOut(), so the SIGNED_OUT the client fires is read as deliberate — no expiry
    // copy, no intended route kept (S2.6 AC10). The provider consumes the flag once.
    markSignOutRequested()
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      toast("Couldn't sign out. Try again.")
    } finally {
      tearDownSession()
      clearIntendedRoute()
      void navigate(paths.login(), { replace: true })
      setIsPending(false)
    }
  }

  return { signOut, isPending }
}
