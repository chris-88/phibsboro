import { useTeamMembers } from '@/api/members'
import { useEventSquad } from '@/api/squad'
import { RemindButton } from '@/features/events/components/RemindButton'
import { ShareButton } from '@/features/events/components/ShareButton'
import type { EventActionData } from '@/features/events/schema'
import { useCurrentUser } from '@/features/auth/use-current-user'
import type { Counts } from '@/lib/counts'
import { serverNow } from '@/lib/serverClock'
import {
  buildMatchShareMessage,
  buildShareMessage,
  type MatchShareSquadMember,
} from '@/lib/shareMessage'

/**
 * Decides whether the share control shows and builds its message (S5.2). Three gates:
 *
 *   AC9 — a manager of that team or an admin. Convenience only, mirroring S2.9's route guard;
 *         RLS is the enforcement layer, and there is nothing to enforce here anyway since sharing
 *         writes nothing.
 *   AC8 — never for a `cancelled` event, and never once `starts_at` has passed, judged by
 *         `serverNow()` (D48), never `Date.now()`. There is nothing useful to share about either.
 *
 * The message is built during render, not in the click handler, so the user gesture stays live
 * when `navigator.share` runs (AC4). A match shares the club teamsheet (S9.3/V8) — team name plus
 * the picked squad — built by `MatchShareControl` so the squad read runs only for a match; every
 * other type keeps D13's availability share. This story adds no query beyond the squad/members
 * reads the manager view already holds warm (D22).
 *
 * S5.3 adds the secondary "Send a reminder" control into the same `data-slot="share"` region,
 * directly beneath the primary button. It takes the derived `Counts` object the S4.3 screen holds
 * — passed straight through, never recomputed here — and hides itself when the awaiting number is
 * absent or zero. Undefined until both counts queries have data, which is why it is optional.
 */
export function EventShareControl({
  event,
  teamName,
  counts,
}: {
  event: EventActionData
  teamName: string
  counts?: Counts
}): React.JSX.Element | null {
  const account = useCurrentUser()
  const canManage = account.status === 'ready' && account.user.isManagerOf(event.team_id)
  if (!canManage) return null

  const started = new Date(event.starts_at).getTime() <= serverNow().getTime()
  if (event.status === 'cancelled' || started) return null

  if (event.type === 'match') {
    return <MatchShareControl event={event} teamName={teamName} counts={counts} />
  }

  return (
    <div data-slot="share" className="flex flex-col gap-2">
      <ShareButton message={buildShareMessage(event)} label="Share to WhatsApp" />
      <RemindButton event={event} counts={counts} />
    </div>
  )
}

/**
 * The match teamsheet share (S9.3). Its own component so `useEventSquad`/`useTeamMembers` run only
 * for a match, both hitting the caches the manager view already warmed (the squad link, the counts
 * poll). The squad rows carry no name — that lives in the team directory — so names are resolved
 * here and the pure generator is handed the finished list. A missing or errored squad leaves the
 * list empty, so the fixture still shares without a side (UI states: share works with no squad).
 */
function MatchShareControl({
  event,
  teamName,
  counts,
}: {
  event: EventActionData
  teamName: string
  counts?: Counts
}): React.JSX.Element {
  const squad = useEventSquad(event.id)
  const members = useTeamMembers(event.team_id)

  const nameByUser = new Map((members.data ?? []).map((m) => [m.user_id, m.name]))
  const squadMembers: MatchShareSquadMember[] = (squad.data ?? []).map((s) => ({
    shirtNumber: s.shirt_number,
    name: nameByUser.get(s.user_id) ?? 'Former member',
    isCaptain: s.is_captain,
  }))

  return (
    <div data-slot="share" className="flex flex-col gap-2">
      <ShareButton
        message={buildMatchShareMessage(event, teamName, squadMembers)}
        label="Share to WhatsApp"
      />
      <RemindButton event={event} counts={counts} />
    </div>
  )
}
