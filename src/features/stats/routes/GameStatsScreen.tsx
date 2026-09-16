import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Minus, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useTeamMembers } from '@/api/members'
import {
  useMatchForStats,
  useMatchStats,
  useSetMatchMeta,
  useSetMatchStat,
  type MatchForStats,
} from '@/api/match-stats'
import { useEventSquad } from '@/api/squad'
import { NotFound } from '@/components/not-found'
import { EmptyState, ErrorState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  bumpCounter,
  buildGameStatsRows,
  clampMinutes,
  type Counter,
  type GameStatsRow,
  type PlayerStat,
} from '@/features/stats/game-stats'
import { paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'
import { useRouteParam } from '@/lib/use-route-param'

const SAVE_ERROR =
  "Couldn't save that — check you're still connected. Your last change may not have stuck."

/**
 * `/squad/game-stats/:id` (S17.4, X5): the manager runs a match from one screen — tap a
 * goal/assist/card against a picked player as it happens, set minutes, pick man of the match, and
 * enter the score, all editable after the whistle. The pool is the selected squad (`event_squad`,
 * S9.2); every tap is an optimistic upsert (D48) so it works on the sideline. Manager-guarded; RLS
 * refuses a player's write (X6). Matches only — a training/social id shows a plain line.
 */
export default function GameStatsScreen(): React.JSX.Element {
  const id = useRouteParam('id')
  const match = useMatchForStats(id)

  if (match.isPending) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <BackLink />
        <HeaderSkeleton />
      </div>
    )
  }
  if (match.isError) {
    return (
      <div className="py-4">
        <BackLink />
        <ErrorState title="Couldn't load the match." onRetry={() => void match.refetch()} />
      </div>
    )
  }
  if (match.data === null) {
    return (
      <div className="py-4">
        <NotFound
          title="Match not found."
          body="It may have been deleted, or the link is out of date."
          actionLabel="Back to Squad"
          actionTo={paths.squad()}
        />
      </div>
    )
  }
  if (match.data.type !== 'match') {
    return (
      <div className="flex flex-col gap-4 py-4">
        <BackLink />
        <EmptyState
          title="Game stats are for matches only."
          body="Training and socials don't collect a scoreline."
        />
      </div>
    )
  }

  return <GameStatsView match={match.data} />
}

function GameStatsView({ match }: { match: MatchForStats }): React.JSX.Element {
  const squad = useEventSquad(match.id)
  const members = useTeamMembers(match.teamId)
  const stats = useMatchStats(match.id)

  const setStat = useSetMatchStat(match.id)
  const setMeta = useSetMatchMeta(match.id)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<Record<string, number>>({})
  const mark = useCallback((userId: string, delta: number) => {
    setPending((p) => ({ ...p, [userId]: Math.max(0, (p[userId] ?? 0) + delta) }))
  }, [])

  const writeStat = useCallback(
    (userId: string, stat: PlayerStat) => {
      setErrorMessage(null)
      mark(userId, 1)
      setStat.mutate(
        { userId, stat },
        {
          onError: () => {
            setErrorMessage(SAVE_ERROR)
          },
          onSettled: () => {
            mark(userId, -1)
          },
        },
      )
    },
    [mark, setStat],
  )

  const nameByUser = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.user_id, m.name])),
    [members.data],
  )
  const rows = useMemo<GameStatsRow[] | null>(
    () =>
      squad.data && stats.data ? buildGameStatsRows(squad.data, stats.data, nameByUser) : null,
    [squad.data, stats.data, nameByUser],
  )

  const failed = squad.isError || members.isError || stats.isError
  const loading = rows === null && !failed

  return (
    <div className="flex flex-col gap-4 py-4">
      <BackLink />

      <Card>
        <CardContent className="flex flex-col gap-1">
          <h2 className="text-lg leading-tight font-semibold text-foreground">{match.title}</h2>
          <p className="text-sm text-muted-foreground">
            {formatEventTime(match.startsAt, 'short')}
          </p>
        </CardContent>
      </Card>

      {errorMessage !== null && (
        <p role="alert" className="px-1 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {failed ? (
        <ErrorState
          title="Couldn't load the game."
          onRetry={() => {
            void squad.refetch()
            void members.refetch()
            void stats.refetch()
          }}
        />
      ) : loading || rows === null ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Pick a squad first."
          body="Game stats are collected for the players you select for the match."
          action={
            <Button asChild>
              <Link to={paths.squadEvent(match.id)}>Pick the squad</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ScoreCard
            match={match}
            rows={rows}
            onScore={(patch) => {
              setErrorMessage(null)
              setMeta.mutate(patch, {
                onError: () => {
                  setErrorMessage(SAVE_ERROR)
                },
              })
            }}
          />
          <section className="flex flex-col gap-2">
            <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Squad
            </h3>
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li key={row.userId}>
                  <PlayerStatRow
                    row={row}
                    saving={(pending[row.userId] ?? 0) > 0}
                    onWrite={(stat) => {
                      writeStat(row.userId, stat)
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

/** The scoreline (us/them) and the man-of-the-match picker (X4) — both write to the event. */
function ScoreCard({
  match,
  rows,
  onScore,
}: {
  match: MatchForStats
  rows: GameStatsRow[]
  onScore: (patch: {
    motmUserId?: string | null
    scoreUs?: number | null
    scoreThem?: number | null
  }) => void
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-3">
          <ScoreInput
            label="Goals for"
            value={match.scoreUs}
            onCommit={(scoreUs) => {
              onScore({ scoreUs })
            }}
          />
          <span className="text-sm font-medium text-muted-foreground">–</span>
          <ScoreInput
            label="Goals against"
            value={match.scoreThem}
            onCommit={(scoreThem) => {
              onScore({ scoreThem })
            }}
          />
        </div>
        <label className="flex flex-col gap-1">
          <span className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Player of the match
          </span>
          <Select
            value={match.motmUserId ?? 'none'}
            onValueChange={(v) => {
              onScore({ motmUserId: v === 'none' ? null : v })
            }}
          >
            <SelectTrigger aria-label="Player of the match">
              <SelectValue placeholder="Not chosen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not chosen</SelectItem>
              {rows.map((r) => (
                <SelectItem key={r.userId} value={r.userId}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </CardContent>
    </Card>
  )
}

/** A whole-number score box, committed on blur (clamped `>= 0`). Keyed by its value in the parent
 *  so an external change re-seeds it without stealing focus mid-type. */
function ScoreInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number | null
  onCommit: (value: number | null) => void
}): React.JSX.Element {
  const [text, setText] = useState(value === null ? '' : String(value))
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      aria-label={label}
      className="h-12 w-16 text-center text-lg font-semibold tabular-nums"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
      }}
      onBlur={() => {
        const parsed = text.trim() === '' ? null : Number(text)
        const clamped =
          parsed === null || Number.isNaN(parsed) ? null : Math.max(0, Math.trunc(parsed))
        onCommit(clamped)
        setText(clamped === null ? '' : String(clamped))
      }}
    />
  )
}

/** One picked player: number, name, the three steppers, a red toggle and a minutes box. Every
 *  change writes the whole desired stat (an idempotent upsert), so a fast double-tap can't
 *  duplicate — it just re-writes the same value. */
function PlayerStatRow({
  row,
  saving,
  onWrite,
}: {
  row: GameStatsRow
  saving: boolean
  onWrite: (stat: PlayerStat) => void
}): React.JSX.Element {
  const { stat } = row
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-center text-sm font-semibold text-muted-foreground tabular-nums">
            {row.shirtNumber}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {row.name}
          </span>
          {row.isCaptain && (
            <Badge variant="secondary" className="shrink-0">
              C
            </Badge>
          )}
          {saving && (
            <Loader2
              className="size-4 shrink-0 animate-spin text-muted-foreground"
              aria-label="Saving"
            />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Stepper
            name={row.name}
            label="Goals"
            short="G"
            value={stat.goals}
            onChange={(delta) => {
              onWrite(bumpCounter(stat, 'goals', delta))
            }}
          />
          <Stepper
            name={row.name}
            label="Assists"
            short="A"
            value={stat.assists}
            onChange={(delta) => {
              onWrite(bumpCounter(stat, 'assists', delta))
            }}
          />
          <Stepper
            name={row.name}
            label="Yellows"
            short="Y"
            value={stat.yellow_cards}
            field="yellow_cards"
            onChange={(delta) => {
              onWrite(bumpCounter(stat, 'yellow_cards', delta))
            }}
          />
          <Button
            type="button"
            size="sm"
            variant={stat.red_card ? 'destructive' : 'outline'}
            className="min-h-tap shrink-0"
            aria-pressed={stat.red_card}
            aria-label={`Red card for ${row.name}`}
            onClick={() => {
              onWrite({ ...stat, red_card: !stat.red_card })
            }}
          >
            Red
          </Button>
          <label className="ml-auto flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Min</span>
            <MinutesInput
              key={stat.minutes ?? 'none'}
              name={row.name}
              value={stat.minutes}
              onCommit={(minutes) => {
                onWrite({ ...stat, minutes })
              }}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  )
}

/** A +/- counter. The value between two 44px buttons; the display for goals/assists/yellows. */
function Stepper({
  name,
  label,
  short,
  value,
  field,
  onChange,
}: {
  name: string
  label: string
  short: string
  value: number
  field?: Counter
  onChange: (delta: number) => void
}): React.JSX.Element {
  const atMax = field === 'yellow_cards' && value >= 2
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-11 shrink-0"
        aria-label={`One fewer ${label.toLowerCase()} for ${name}`}
        disabled={value <= 0}
        onClick={() => {
          onChange(-1)
        }}
      >
        <Minus className="size-4" aria-hidden="true" />
      </Button>
      <span className="w-8 text-center text-sm font-semibold text-foreground tabular-nums">
        <span className="text-muted-foreground">{short}</span> {value}
      </span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="size-11 shrink-0"
        aria-label={`One more ${label.toLowerCase()} for ${name}`}
        disabled={atMax}
        onClick={() => {
          onChange(1)
        }}
      >
        <Plus className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}

/** Minutes played, committed on blur (clamped 0–200). Keyed by its value in the parent so an
 *  optimistic re-sync re-seeds it. */
function MinutesInput({
  name,
  value,
  onCommit,
}: {
  name: string
  value: number | null
  onCommit: (value: number | null) => void
}): React.JSX.Element {
  const [text, setText] = useState(value === null ? '' : String(value))
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={0}
      max={200}
      aria-label={`Minutes for ${name}`}
      className="h-11 w-16 text-center tabular-nums"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
      }}
      onBlur={() => {
        const parsed = text.trim() === '' ? null : Number(text)
        const clamped = clampMinutes(parsed)
        onCommit(clamped)
        setText(clamped === null ? '' : String(clamped))
      }}
    />
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
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-4 w-2/5" />
      </CardContent>
    </Card>
  )
}

function ListSkeleton(): React.JSX.Element {
  return (
    <ul
      className="flex flex-col gap-2"
      role="status"
      aria-busy="true"
      aria-label="Loading the game"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i}>
          <Card size="sm">
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-11 w-full" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
