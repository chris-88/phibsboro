import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { useInviteLookup } from '@/api/invites'
import { useJoinTeamByEvent, useJoinTeamByToken } from '@/api/joins'
import { clearPendingJoin, readPendingJoin, type PendingJoin } from '@/features/auth/pending-join'
import { useSession } from '@/features/auth/session-context'
import { classifyJoinError } from '@/features/teams/joinErrors'

export interface PendingJoinResume {
  status: 'idle' | 'joining' | 'done'
  /** The joining team's name for the overlay, from the invite lookup on the token path; null on
   *  the event path, where no name is available before the join returns. */
  teamName: string | null
}

/**
 * Waypoints own their own join: `/register` joins inline as S2.1's step 2 and clears the key,
 * `/join/:token` joins on tap, and `/login` navigates to home the instant it succeeds. Resuming
 * on any of them would double the register join (its key is still set mid-mutation) and flash the
 * overlay over the form, so the resume defers until the app is on a real route — home, or the
 * deep-linked event — which is exactly where the sign-in and cold-start paths need it (AC3, AC4).
 */
const WAYPOINTS = ['/login', '/register', '/join/', '/reset/']

/**
 * The resume that finishes an interrupted join (S2.4). Mounted once by `PendingJoinGate` in the
 * router root, inside S2.6's session gate. It exists for the paths S2.1 does not cover: sign-in
 * (S2.2 does no join) and a cold start where the session is restored with `pfc.pendingJoin` still
 * set. On the registration path it finds nothing and returns `done`, because S2.1 already joined
 * and cleared the key.
 *
 * The join fires exactly once — a `useRef` guards React's strict-mode double effect, and the RPC
 * is idempotent anyway (D26). Success and `invalid_invite` both clear the key and finish; a
 * network failure keeps the key so the next cold start retries (AC14). Only once `done` may S2.5
 * consume the intended route (S2.5 AC7).
 */
export function usePendingJoinResume(): PendingJoinResume {
  const session = useSession()
  const { pathname } = useLocation()
  const onWaypoint = WAYPOINTS.some((p) => pathname === p || pathname.startsWith(p))
  const active = session.status === 'signedIn' && !onWaypoint

  const joinByToken = useJoinTeamByToken()
  const joinByEvent = useJoinTeamByEvent()

  // Read the pending join once, when the app is eligible to act. Memoised so a later clear does
  // not change what this render sees, and so the fire effect below runs against a stable value.
  const pending = useMemo<PendingJoin | null>(() => (active ? readPendingJoin() : null), [active])

  // The token drives the name lookup for the overlay; the event path has no name to show.
  const lookup = useInviteLookup(pending?.kind === 'token' ? pending.token : undefined)

  // `settled` flips only inside the mutation callbacks (never synchronously in the effect), so the
  // status is derived rather than pushed, and a dead link or a network failure both land on `done`.
  const [settled, setSettled] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!pending || started.current) return
    started.current = true

    const onSuccess = (): void => {
      clearPendingJoin()
      setSettled(true)
    }
    const onError = (e: unknown): void => {
      // A dead link is terminal: clear it. A network failure keeps the key for the next cold
      // start; finishing either way drops the user onto the route they were headed for (AC14).
      if (classifyJoinError(e) === 'invalid') clearPendingJoin()
      setSettled(true)
    }

    if (pending.kind === 'token') {
      joinByToken.mutate(pending.token, { onSuccess, onError })
    } else {
      joinByEvent.mutate(pending.eventId, { onSuccess, onError })
    }
    // Fired once, guarded by `started`; the mutation objects are stable for the mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])

  const status: PendingJoinResume['status'] = !active
    ? 'idle'
    : pending === null || settled
      ? 'done'
      : 'joining'

  return { status, teamName: status === 'joining' ? (lookup.data?.team_name ?? null) : null }
}
