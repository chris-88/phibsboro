import { Loader2 } from 'lucide-react'
import { useIntendedRoute } from '@/features/auth/use-intended-route'
import { usePendingJoinResume } from '@/features/teams/usePendingJoinResume'

/** The full-screen "Joining {team}…" state, over the whole app — no nav, no back — while a
 *  resumed join is in flight, so a player never sees an empty home screen first (AC16). The team
 *  name comes from the token lookup; the event path has none, so it reads "Joining…". */
function Joining({ teamName }: { teamName: string | null }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Joining"
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-4 text-center"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        {teamName === null ? 'Joining…' : `Joining ${teamName}…`}
      </p>
    </div>
  )
}

/**
 * Mounts the pending-join resume once, in the router root inside S2.6's session gate and above
 * S2.5's restore (S2.4). While a resumed join runs it renders the full-screen joining state over
 * the routed content; otherwise it is transparent, rendering the app unchanged. The ordering — the
 * join finishes before the route settles — is why a deep-linked event renders as a member rather
 * than a preview (S2.5 AC7).
 *
 * It also mounts S2.5's cold-start restore here, where the resume status already lives, so the
 * intended route is consumed only once the join is `done`. `status === 'done'` implies the session
 * is signed in and settled (the resume reaches `done` only when active), which is exactly S2.5's
 * `enabled` gate; a signed-out visitor sits at `idle`, so the hook leaves their destination stored.
 */
export function PendingJoinGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status, teamName } = usePendingJoinResume()
  useIntendedRoute(status === 'done')
  if (status === 'joining') return <Joining teamName={teamName} />
  return <>{children}</>
}
