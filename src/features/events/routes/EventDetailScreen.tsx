import { useNavigate, type NavigateFunction } from 'react-router'
import { useEventDetail, useEventPreview, type EventDetail } from '@/api/events'
import { useJoinTeamByEvent } from '@/api/joins'
import { NotFound } from '@/components/not-found'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AvailabilityButtons } from '@/features/availability/components/AvailabilityButtons'
import { useResponseWindow } from '@/features/availability/use-response-window'
import { setPendingJoin } from '@/features/auth/pending-join'
import { useSession } from '@/features/auth/session-context'
import { CancelledBanner } from '@/features/events/components/CancelledBanner'
import { EventMeta } from '@/features/events/components/EventMeta'
import { EventPreviewCard } from '@/features/events/components/EventPreviewCard'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import type { EventPreview } from '@/features/events/schema'
import { JoinTeamPanel } from '@/features/teams/components/JoinTeamPanel'
import { classifyJoinError } from '@/features/teams/joinErrors'
import { setIntendedRoute } from '@/lib/intended-route'
import { paths } from '@/lib/paths'
import { useRouteParam } from '@/lib/use-route-param'
import { uuidSchema } from '@/lib/zod'

/** The 404 for an event that does not exist, or an id that is not even a uuid (D49, AC13). Its own
 *  copy, not the generic "Nothing here.", so a mistyped link reads as an event problem. */
function EventNotFound(): React.JSX.Element {
  return (
    <NotFound
      title="We can't find that event."
      body="It may have been called off, or the link is out of date."
    />
  )
}

/** Same height as the populated card, so nothing jumps when the data arrives (AC17). */
function EventDetailSkeleton({ withButtons }: { withButtons: boolean }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true" aria-label="Loading">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
      {withButtons && (
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}
    </div>
  )
}

/** The member view: the full event and the availability controls. The window is decided once, by
 *  `useResponseWindow`, so cancelled and after-`starts_at` share the single decision point (S3.4
 *  AC13) and the buttons disable themselves at kick-off with no reload (AC8). */
function MemberView({ detail }: { detail: EventDetail }): React.JSX.Element {
  const responseState = useResponseWindow({ status: detail.status, starts_at: detail.startsAt })
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{detail.teamName}</p>
          {detail.status === 'cancelled' && <CancelledBanner />}
          <div className="flex flex-col gap-2">
            <EventTypeBadge type={detail.type} />
            <h2 className="text-lg leading-snug font-semibold text-foreground">{detail.title}</h2>
          </div>
          <EventMeta startsAt={detail.startsAt} location={detail.location} notes={detail.notes} />
        </CardContent>
      </Card>
      <AvailabilityButtons
        eventId={detail.id}
        current={detail.myResponse}
        disabled={!responseState.open}
        disabledReason={responseState.open ? undefined : responseState.message}
      />
    </div>
  )
}

/** Writes the two stores S2.1 and S2.5 consume, then leaves for the auth screen. One store answers
 *  "which team do you belong to", the other "which screen do you land on"; neither is derived from
 *  the other and neither is written by hand (AC11). */
function goToAuth(path: string, eventId: string, navigate: NavigateFunction): void {
  setPendingJoin({ kind: 'event', eventId })
  setIntendedRoute(paths.event(eventId))
  void navigate(path)
}

/** The preview for a signed-in non-member: one primary button that joins the team on the spot.
 *  The join takes the event id, not the team id — the preview never carries an id, so the screen
 *  passes it down. On success the member query refetches and the screen re-renders as the member
 *  view without a reload (AC10). A dead-link refusal replaces the panel with `InviteInvalid`
 *  inline, keeping the event details above it; a network failure keeps the button (S2.4 AC12). */
function NonMemberPreview({
  preview,
  eventId,
}: {
  preview: EventPreview
  eventId: string
}): React.JSX.Element {
  const join = useJoinTeamByEvent()
  return (
    <EventPreviewCard preview={preview}>
      <JoinTeamPanel
        teamName={preview.team_name}
        pending={join.isPending}
        failure={join.isError ? classifyJoinError(join.error) : null}
        onJoin={() => {
          join.mutate(eventId)
        }}
      />
    </EventPreviewCard>
  )
}

/** The preview for a stranger: join leads to registration, with a sign-in link for a returning
 *  player. Both paths write the pending join and the intended route first (AC11). */
function AnonymousPreview({
  preview,
  eventId,
}: {
  preview: EventPreview
  eventId: string
}): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <EventPreviewCard preview={preview}>
      <div className="flex flex-col items-center gap-2">
        <Button
          type="button"
          size="lg"
          className="min-h-14 w-full"
          onClick={() => {
            goToAuth(paths.register(), eventId, navigate)
          }}
        >
          Join {preview.team_name}
        </Button>
        <Button
          type="button"
          variant="link"
          onClick={() => {
            goToAuth(paths.login(), eventId, navigate)
          }}
        >
          Already registered? Sign in
        </Button>
      </div>
    </EventPreviewCard>
  )
}

/**
 * The deep-link target `/event/:id` (D6, D7, D34). It renders for three visitors: a member reads
 * the event through the RLS-protected hook and answers YES / NO; a signed-in non-member and a
 * stranger both see the preview and one way in. The render order is error, then loading, then
 * member, then preview, then 404 — error first so a failed load never reads as "no such event",
 * the 404 last so it is only reached once the server has answered "no rows" twice.
 */
export default function EventDetailScreen(): React.JSX.Element {
  const rawId = useRouteParam('id')
  const parsed = uuidSchema.safeParse(rawId)
  const eventId = parsed.success ? parsed.data : undefined

  const session = useSession()
  const signedIn = session.status === 'signedIn'
  const signedOut = session.status === 'signedOut'

  const detail = useEventDetail(eventId)
  // Gate the preview on the detail read so a member never sees the preview flash: a signed-out
  // visitor gets it straight away, a signed-in one only once the member read has come back empty.
  const previewEnabled =
    eventId !== undefined && (signedOut || (detail.isSuccess && detail.data === null))
  const preview = useEventPreview(previewEnabled ? eventId : undefined)

  // A malformed id is a 404 with no network call (AC13); the queries above stayed disabled.
  if (!parsed.success) return <EventNotFound />

  if (detail.isError || preview.isError) {
    return (
      <ErrorState
        title="Couldn't load this event."
        onRetry={() => {
          if (detail.isError) void detail.refetch()
          if (preview.isError) void preview.refetch()
        }}
      />
    )
  }

  const detailPending = signedIn && !detail.isSuccess && !detail.isError
  const previewPending = previewEnabled && !preview.isSuccess && !preview.isError
  if (session.status === 'loading' || detailPending || previewPending) {
    return <EventDetailSkeleton withButtons={signedIn} />
  }

  if (detail.data) return <MemberView detail={detail.data} />
  if (preview.data) {
    return signedIn ? (
      <NonMemberPreview preview={preview.data} eventId={parsed.data} />
    ) : (
      <AnonymousPreview preview={preview.data} eventId={parsed.data} />
    )
  }

  // Both reads settled and both returned nothing: the event does not exist for anyone.
  return <EventNotFound />
}
