import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useBulkMarkAttended, useSetAttendance } from '@/api/attendance'
import { NotFound } from '@/components/not-found'
import { EmptyState, ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useEventAttendance,
  useEventDetail,
  useEventResponses,
  type EventDetail,
} from '@/api/events'
import { useTeamMembers } from '@/api/members'
import {
  EventCountsPanel,
  EventCountsPanelSkeleton,
} from '@/features/events/components/EventCountsPanel'
import { EventHeaderCard } from '@/features/events/components/EventHeaderCard'
import {
  PlayerResponseList,
  PlayerResponseListSkeleton,
} from '@/features/events/components/PlayerResponseList'
import type { EventActionData } from '@/features/events/schema'
import { useManageStore } from '@/features/teams/manageStore'
import { deriveCounts, type Counts } from '@/lib/counts'
import { paths } from '@/lib/paths'
import { availableForAttendance, buildRoster, type RosterRow } from '@/lib/roster'
import { useRouteParam } from '@/lib/use-route-param'

/** Both live reads poll every 30s and refetch on focus while this screen is mounted (D23). The
 *  default `refetchIntervalInBackground: false` already stops the poll while the tab is hidden. */
const LIVE = { refetchInterval: 30_000, refetchOnWindowFocus: true } as const

/**
 * `/manage/event/:id` (S4.3): the manager's view of one event. The header (with S4.2's Edit,
 * Cancel/Reinstate and Delete), the four counts, and the "Who's in" section S4.4 later fills.
 * The route guard already sent a player home (AC11); RLS is the real boundary and returns an
 * unmanaged team's event as `null`, which is the same "Event not found" as an unknown id (AC10).
 */
export default function ManageEventScreen(): React.JSX.Element {
  const id = useRouteParam('id')
  const detail = useEventDetail(id)

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <BackLink />
        <EventHeaderSkeleton />
        <EventCountsPanelSkeleton />
      </div>
    )
  }
  if (detail.isError) {
    return (
      <div className="py-4">
        <ErrorState title="Couldn't load that event." onRetry={() => void detail.refetch()} />
      </div>
    )
  }
  if (detail.data === null) {
    // Unknown id, or an event on a team the caller does not manage — indistinguishable by design
    // (AC10). RLS returned zero rows either way.
    return (
      <div className="py-4">
        <NotFound
          title="Event not found."
          body="It may have been deleted, or the link is out of date."
          actionLabel="Back to Manage"
          actionTo={paths.manage()}
        />
      </div>
    )
  }

  return <ManagerEventView detail={detail.data} />
}

function ManagerEventView({ detail }: { detail: EventDetail }): React.JSX.Element {
  const navigate = useNavigate()
  // Point the manage area at this event's team, so an admin opening an event on a team other than
  // the selected one switches to it — the header and the members link then follow the event, and
  // going back to /manage lands on the right team (S6.3 AC7). The event query is keyed on the id
  // and does not depend on the selection, so this is a follow, not a scoping branch.
  const setSelectedTeamId = useManageStore((s) => s.setSelectedTeamId)
  useEffect(() => {
    setSelectedTeamId(detail.teamId)
  }, [detail.teamId, setSelectedTeamId])
  const responses = useEventResponses(detail.id, LIVE)
  const members = useTeamMembers(detail.teamId, LIVE)
  const attendance = useEventAttendance(detail.id, LIVE)

  // Both mapped to `userId` at the call site so `deriveCounts` keeps a shape that owes nothing to
  // PostgREST. No `?? []` default: a count built from one loaded query and one empty fallback is a
  // wrong number, which AC13 forbids — `counts` stays null until both have data.
  const squad = useMemo(() => members.data?.map((m) => ({ userId: m.user_id })), [members.data])
  const responded = useMemo(
    () => responses.data?.map((r) => ({ userId: r.user_id, response: r.response })),
    [responses.data],
  )
  const counts: Counts | null = useMemo(
    () => (squad && responded ? deriveCounts(squad, responded) : null),
    [squad, responded],
  )

  // The response list reads the same two cached queries the counts do — `teamKeys.members` and
  // `eventKeys.responses` — plus attendance, so the cards and the counts can never disagree (AC9).
  // Derived once here, the single owner, mirroring the counts. `undefined` means still loading, and
  // is distinct from `[]`, an event whose team has no members.
  const rosterMembers = useMemo(
    () => members.data?.map((m) => ({ userId: m.user_id, name: m.name, role: m.role })),
    [members.data],
  )
  const rosterResponses = useMemo(
    () => responses.data?.map((r) => ({ userId: r.user_id, response: r.response })),
    [responses.data],
  )
  const roster: RosterRow[] | null = useMemo(
    () =>
      rosterMembers && rosterResponses && attendance.data
        ? buildRoster(rosterMembers, rosterResponses, attendance.data)
        : null,
    [rosterMembers, rosterResponses, attendance.data],
  )

  // Attendance writes (S4.5). Both mutations own only the `eventKeys.attendance` cache, so the
  // counts above never move on a mark (AC12). Per-row saving and failed state lives here, not in
  // the hook, since a mutation instance tracks one call at a time but many rows write in parallel.
  const setAttendance = useSetAttendance(detail.id)
  const bulkMark = useBulkMarkAttended(detail.id)
  const cancelled = detail.status === 'cancelled'
  const [savingUserIds, setSavingUserIds] = useState<ReadonlySet<string>>(new Set())
  const [failedUserIds, setFailedUserIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [bulkFailed, setBulkFailed] = useState(false)

  const withoutId = (set: ReadonlySet<string>, id: string): Set<string> => {
    const next = new Set(set)
    next.delete(id)
    return next
  }
  const withId = (set: ReadonlySet<string>, id: string): Set<string> => new Set(set).add(id)

  const handleAttendanceChange = useCallback(
    (userId: string, attended: boolean | null) => {
      // Clear any prior failure for this row and flag it saving; the per-call callbacks below flip
      // it back on settle, so only this card shows a spinner and the line without touching others.
      setFailedUserIds((prev) => withoutId(prev, userId))
      setSavingUserIds((prev) => withId(prev, userId))
      setAttendance.mutate(
        { userId, attended },
        {
          onError: () => {
            setFailedUserIds((prev) => withId(prev, userId))
          },
          onSettled: () => {
            setSavingUserIds((prev) => withoutId(prev, userId))
          },
        },
      )
    },
    [setAttendance],
  )

  const availableIds = roster ? availableForAttendance(roster) : []
  const runBulk = (): void => {
    setBulkMessage(null)
    setBulkFailed(false)
    bulkMark.mutate(availableIds, {
      onSuccess: (written) => {
        setBulkMessage(written > 0 ? `Marked ${String(written)} as attended.` : 'Nothing to mark.')
      },
      onError: () => {
        setBulkFailed(true)
      },
    })
  }

  // Reused by S4.2's action components. Every field is a real value from the detail read; the four
  // audit columns those components never touch are not in the projection, which is why the prop is
  // narrowed to EventActionData (schema.ts).
  const eventForMenu: EventActionData = {
    id: detail.id,
    team_id: detail.teamId,
    type: detail.type,
    title: detail.title,
    location: detail.location,
    notes: detail.notes,
    opponent: detail.opponent,
    home_away: detail.homeAway,
    starts_at: detail.startsAt,
    status: detail.status,
  }

  const countsFailed = responses.isError || members.isError
  const membersEmpty = members.data?.length === 0
  const rosterFailed = responses.isError || members.isError || attendance.isError

  return (
    <div className="flex flex-col gap-4 py-4">
      <BackLink />

      <EventHeaderCard
        event={eventForMenu}
        teamName={detail.teamName}
        counts={counts ?? undefined}
        onDeleted={() => void navigate(paths.manage())}
      />

      {countsFailed ? (
        <ErrorState
          title="Couldn't load the responses."
          onRetry={() => {
            void responses.refetch()
            void members.refetch()
          }}
        />
      ) : counts === null ? (
        <EventCountsPanelSkeleton />
      ) : (
        <EventCountsPanel counts={counts} />
      )}

      {/* Managers respond on the player side; this links there rather than duplicating YES / NO. */}
      <Card size="sm">
        <CardContent>
          <Link
            to={paths.event(detail.id)}
            className="flex min-h-tap items-center justify-between gap-2 text-sm font-medium text-foreground"
          >
            Set your own availability
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Who&apos;s in
          </h3>
          {/* The bulk action sits beside the section head (D42). Disabled until the roster resolves
              so it never flips absent-then-present, when no member is available, and on a cancelled
              event. It reads the cached roster, so no extra query. */}
          {!rosterFailed && !membersEmpty && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-tap"
              onClick={runBulk}
              disabled={
                roster === null || cancelled || availableIds.length === 0 || bulkMark.isPending
              }
            >
              Mark available as attended
            </Button>
          )}
        </div>
        {/* AC6: the outcome of a run is announced politely; a failure offers a retry beside it. */}
        {(bulkMessage !== null || bulkFailed) && (
          <div className="flex items-center gap-2 px-1" aria-live="polite">
            {bulkFailed ? (
              <>
                <span className="text-xs text-destructive">Couldn&apos;t save.</span>
                <Button type="button" size="sm" variant="outline" onClick={runBulk}>
                  Retry
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{bulkMessage}</span>
            )}
          </div>
        )}
        {rosterFailed ? (
          <ErrorState
            title="Couldn't load the squad."
            onRetry={() => {
              void responses.refetch()
              void members.refetch()
              void attendance.refetch()
            }}
          />
        ) : membersEmpty ? (
          <EmptyState
            title="No one has joined this team yet."
            action={
              <Button asChild variant="outline">
                <Link to={paths.teamMembers(detail.teamId)}>Get the join link</Link>
              </Button>
            }
          />
        ) : roster === null ? (
          <PlayerResponseListSkeleton />
        ) : (
          <PlayerResponseList
            rows={roster}
            onAttendanceChange={handleAttendanceChange}
            savingUserIds={savingUserIds}
            failedUserIds={failedUserIds}
            disabledReason={cancelled ? 'Cancelled — nothing to record.' : undefined}
          />
        )}
      </section>
    </div>
  )
}

function BackLink(): React.JSX.Element {
  return (
    <Link
      to={paths.manage()}
      className="inline-flex min-h-tap items-center gap-1 self-start text-sm font-medium text-muted-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Manage
    </Link>
  )
}

function EventHeaderSkeleton(): React.JSX.Element {
  return (
    <Card>
      <CardContent
        className="flex flex-col gap-3"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  )
}
