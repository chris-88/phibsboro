import { useMemo } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
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
import { deriveCounts, type Counts } from '@/lib/counts'
import { paths } from '@/lib/paths'
import { buildRoster, type RosterRow } from '@/lib/roster'
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
        <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Who&apos;s in
        </h3>
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
          // Read-only in S4.4: no `onAttendanceChange`, so every attendance control is disabled.
          // S4.5 supplies the handler and this component does not change (Definition of done).
          <PlayerResponseList rows={roster} />
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
