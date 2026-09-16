import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { Link } from 'react-router'
import { useEventResponses, useEventDetail, type EventDetail } from '@/api/events'
import { useTeamMembers } from '@/api/members'
import { useEventSquad, useRemoveSquadMember, useSetCaptain, useSetSquadMember } from '@/api/squad'
import { NotFound } from '@/components/not-found'
import { EmptyState, ErrorState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EventTypeBadge } from '@/features/events/components/EventTypeBadge'
import { ShareButton } from '@/features/events/components/ShareButton'
import {
  buildPickerModel,
  freeNumbers,
  MAX_SQUAD,
  type PickerEntry,
} from '@/features/events/squad-picker'
import {
  buildMatchShareMessage,
  type MatchShareEvent,
  type MatchShareSquadMember,
} from '@/lib/shareMessage'
import type { AppError } from '@/lib/errors'
import { mapRpcError } from '@/lib/errors'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'
import { useRouteParam } from '@/lib/use-route-param'

/** Both live reads poll while the picker is open, so a late availability answer or a second
 *  manager's edit lands without a manual refresh. */
const LIVE = { refetchInterval: 30_000, refetchOnWindowFocus: true } as const

/**
 * `/squad/event/:id` (S9.2): the manager's squad picker for one match. Reached from the Squad tab
 * matchday list (S10.3) and from the "Pick squad" link on the match manager view (S4.3) — two
 * entry points, one editor. The guard already sent a player home; RLS is the real boundary and
 * returns an unmanaged team's event as `null`, the same "Event not found" as an unknown id.
 * Squads are match-only (AC6): a training or social id shows a plain "matches only" line.
 */
export default function SquadPickerScreen(): React.JSX.Element {
  const id = useRouteParam('id')
  const detail = useEventDetail(id)

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <BackLink />
        <HeaderSkeleton />
      </div>
    )
  }
  if (detail.isError) {
    return (
      <div className="py-4">
        <BackLink />
        <ErrorState title="Couldn't load the squad." onRetry={() => void detail.refetch()} />
      </div>
    )
  }
  if (detail.data === null) {
    return (
      <div className="py-4">
        <NotFound
          title="Event not found."
          body="It may have been deleted, or the link is out of date."
          actionLabel="Back to Squad"
          actionTo={paths.squad()}
        />
      </div>
    )
  }
  if (detail.data.type !== 'match') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <BackLink />
        <EmptyState
          title="Squads are for matches only."
          body="Training and socials don't need a picked side."
        />
      </div>
    )
  }

  return <SquadPickerView detail={detail.data} />
}

function SquadPickerView({ detail }: { detail: EventDetail }): React.JSX.Element {
  const responses = useEventResponses(detail.id, LIVE)
  const members = useTeamMembers(detail.teamId, LIVE)
  const squad = useEventSquad(detail.id)

  const setMember = useSetSquadMember(detail.id)
  const setCaptain = useSetCaptain(detail.id)
  const removeMember = useRemoveSquadMember(detail.id)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const onError = useCallback((error: AppError) => {
    setErrorMessage(mapRpcError(error.code))
  }, [])
  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  const pickerMembers = useMemo(
    () => members.data?.map((m) => ({ userId: m.user_id, name: m.name })),
    [members.data],
  )
  const pickerResponses = useMemo(
    () => responses.data?.map((r) => ({ userId: r.user_id, response: r.response })),
    [responses.data],
  )
  const pickerPicks = useMemo(
    () =>
      squad.data?.map((s) => ({
        userId: s.user_id,
        shirtNumber: s.shirt_number,
        isCaptain: s.is_captain,
      })),
    [squad.data],
  )

  const model = useMemo(
    () =>
      pickerMembers && pickerResponses && pickerPicks
        ? buildPickerModel(pickerMembers, pickerResponses, pickerPicks)
        : null,
    [pickerMembers, pickerResponses, pickerPicks],
  )

  const handleAdd = useCallback(
    (userId: string) => {
      const nextFree = model?.nextFreeNumber ?? null
      if (nextFree === null) return
      clearError()
      setMember.mutate({ userId, shirtNumber: nextFree, isCaptain: false }, { onError })
    },
    [model, setMember, onError, clearError],
  )

  const handleRenumber = useCallback(
    (entry: PickerEntry, shirtNumber: number) => {
      clearError()
      setMember.mutate(
        { userId: entry.userId, shirtNumber, isCaptain: entry.isCaptain },
        { onError },
      )
    },
    [setMember, onError, clearError],
  )

  const handleRemove = useCallback(
    (userId: string) => {
      clearError()
      removeMember.mutate(userId, { onError })
    },
    [removeMember, onError, clearError],
  )

  const handleCaptain = useCallback(
    (entry: PickerEntry, currentCaptain: PickerEntry | undefined) => {
      if (entry.shirtNumber === null) return
      clearError()
      const makeCaptain = !entry.isCaptain
      setCaptain.mutate(
        {
          userId: entry.userId,
          shirtNumber: entry.shirtNumber,
          makeCaptain,
          previousCaptain:
            makeCaptain && currentCaptain !== undefined && currentCaptain.shirtNumber !== null
              ? { userId: currentCaptain.userId, shirtNumber: currentCaptain.shirtNumber }
              : null,
        },
        { onError },
      )
    },
    [setCaptain, onError, clearError],
  )

  const failed = responses.isError || members.isError || squad.isError

  // The teamsheet share lives here on the Squad view, not on the Schedule tab (Chris, 2026-09-16):
  // the numbered side is chosen here, so it is shared from here. Built from the picked squad and the
  // team directory, the same club format as the availability invite minus the squad section.
  const shareEvent: MatchShareEvent = {
    id: detail.id,
    opponent: detail.opponent,
    home_away: detail.homeAway,
    jersey: detail.jersey,
    location: detail.location,
    starts_at: detail.startsAt,
    meet_at: detail.meetAt,
  }
  const shareNames = new Map((members.data ?? []).map((m) => [m.user_id, m.name]))
  const shareSquad: MatchShareSquadMember[] = (squad.data ?? []).map((s) => ({
    shirtNumber: s.shirt_number,
    name: shareNames.get(s.user_id) ?? 'Former member',
    isCaptain: s.is_captain,
  }))

  return (
    <div className="flex flex-col gap-4 py-4">
      <BackLink />

      <Card>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <EventTypeBadge type={detail.type} />
            {model !== null && (
              <span className="ml-auto text-sm font-semibold text-muted-foreground tabular-nums">
                {model.count} / {MAX_SQUAD}
              </span>
            )}
          </div>
          <h2 className="text-lg leading-tight font-semibold text-foreground">{detail.title}</h2>
          <p className="text-sm text-muted-foreground">
            {formatEventTime(detail.startsAt, 'short')}
          </p>
        </CardContent>
      </Card>

      {/* Share the numbered teamsheet once a side is picked (S5.2 controls, S9.3 message). */}
      {shareSquad.length > 0 && (
        <Card>
          <CardContent>
            <ShareButton
              message={buildMatchShareMessage(shareEvent, detail.teamName, shareSquad)}
              label="Share squad to WhatsApp"
            />
          </CardContent>
        </Card>
      )}

      {errorMessage !== null && (
        <p role="alert" className="px-1 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {failed ? (
        <ErrorState
          title="Couldn't load the squad."
          onRetry={() => {
            void responses.refetch()
            void members.refetch()
            void squad.refetch()
          }}
        />
      ) : model === null ? (
        <PickerSkeleton />
      ) : model.picked.length === 0 && model.available.length === 0 ? (
        <EmptyState
          title="No one's available yet."
          body="Players you pick from appear here once they say they're in."
        />
      ) : (
        <PickerBody
          model={model}
          onAdd={handleAdd}
          onRenumber={handleRenumber}
          onRemove={handleRemove}
          onCaptain={handleCaptain}
        />
      )}
    </div>
  )
}

interface PickerBodyProps {
  model: NonNullable<ReturnType<typeof buildPickerModel>>
  onAdd: (userId: string) => void
  onRenumber: (entry: PickerEntry, shirtNumber: number) => void
  onRemove: (userId: string) => void
  onCaptain: (entry: PickerEntry, currentCaptain: PickerEntry | undefined) => void
}

function PickerBody({
  model,
  onAdd,
  onRenumber,
  onRemove,
  onCaptain,
}: PickerBodyProps): React.JSX.Element {
  const captain = model.picked.find((e) => e.isCaptain)
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          In the squad
        </h3>
        {model.picked.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No one picked yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {model.picked.map((entry) => (
              <li key={entry.userId}>
                <PickedRow
                  entry={entry}
                  takenNumbers={model.takenNumbers}
                  onRenumber={onRenumber}
                  onRemove={onRemove}
                  onCaptain={() => {
                    onCaptain(entry, captain)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Available
        </h3>
        {model.available.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">Everyone available is picked.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {model.available.map((entry) => (
              <li key={entry.userId}>
                <AvailableRow
                  entry={entry}
                  atCapacity={model.atCapacity}
                  onAdd={() => {
                    onAdd(entry.userId)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

interface PickedRowProps {
  entry: PickerEntry
  takenNumbers: ReadonlySet<number>
  onRenumber: (entry: PickerEntry, shirtNumber: number) => void
  onRemove: (userId: string) => void
  onCaptain: () => void
}

/** One picked player: their number (a Select to renumber), name, a captain toggle and a remove
 *  button. A player who has since gone unavailable wears a "Not available" flag but stays fully
 *  editable and removable (V7). */
function PickedRow({
  entry,
  takenNumbers,
  onRenumber,
  onRemove,
  onCaptain,
}: PickedRowProps): React.JSX.Element {
  const current = entry.shirtNumber ?? 0
  // The free numbers plus this player's own, so the Select can keep or change the number.
  const options = useMemo(() => {
    const free = freeNumbers(takenNumbers)
    return [...free, current].sort((a, b) => a - b)
  }, [takenNumbers, current])

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-2">
        <Select
          value={String(current)}
          onValueChange={(next) => {
            onRenumber(entry, Number(next))
          }}
        >
          <SelectTrigger
            size="sm"
            className="min-h-tap w-16 shrink-0 justify-center font-semibold tabular-nums"
            aria-label={`Shirt number for ${entry.name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {entry.name}
            </span>
            {entry.isCaptain && (
              <Badge variant="secondary" className="shrink-0">
                C
              </Badge>
            )}
          </span>
          {entry.unavailableFlag && (
            <span className="text-xs font-medium text-destructive">Not available</span>
          )}
        </span>

        <Button
          type="button"
          size="sm"
          variant={entry.isCaptain ? 'default' : 'outline'}
          className="min-h-tap shrink-0"
          onClick={onCaptain}
          aria-pressed={entry.isCaptain}
        >
          Captain
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11 shrink-0"
          onClick={() => {
            onRemove(entry.userId)
          }}
          aria-label={`Remove ${entry.name} from the squad`}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  )
}

interface AvailableRowProps {
  entry: PickerEntry
  atCapacity: boolean
  onAdd: () => void
}

/** One available, not-yet-picked player: name and an Add button that assigns the lowest free
 *  number. Disabled once the squad is full. */
function AvailableRow({ entry, atCapacity, onAdd }: AvailableRowProps): React.JSX.Element {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {entry.name}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="min-h-tap shrink-0"
          onClick={onAdd}
          disabled={atCapacity}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </CardContent>
    </Card>
  )
}

function BackLink(): React.JSX.Element {
  return (
    <Link
      to={paths.squad()}
      className="inline-flex min-h-tap items-center gap-1 self-start text-sm font-medium text-muted-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Squad
    </Link>
  )
}

function HeaderSkeleton(): React.JSX.Element {
  return (
    <Card>
      <CardContent
        className="flex flex-col gap-2"
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </CardContent>
    </Card>
  )
}

function PickerSkeleton(): React.JSX.Element {
  return (
    <ul
      className="flex flex-col gap-2"
      role="status"
      aria-busy="true"
      aria-label="Loading the squad"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i}>
          <Card size="sm">
            <CardContent className="flex items-center gap-2">
              <Skeleton className="size-11 w-16 shrink-0 rounded-lg" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="size-11 w-20 shrink-0 rounded-lg" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
