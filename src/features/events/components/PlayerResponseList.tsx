import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PlayerResponseCard,
  type PlayerResponseCardProps,
} from '@/features/events/components/PlayerResponseCard'
import type { RosterRow } from '@/lib/roster'

export interface PlayerResponseListProps {
  rows: readonly RosterRow[]
  /** Forwarded to every card. Omitted in S4.4 (the control is inert); supplied by S4.5. */
  onAttendanceChange?: PlayerResponseCardProps['onAttendanceChange']
  /** The `userId`s whose write is in flight (S4.5). Each row saves independently, so a set. */
  savingUserIds?: ReadonlySet<string>
  /** The `userId`s whose last write failed (S4.5): the inline "Tap again." line renders under that
   *  card, control still enabled, without touching the frozen card markup (AC9). */
  failedUserIds?: ReadonlySet<string>
  /** Rendered under every control when the event forbids editing, e.g. cancelled (S4.5). */
  disabledReason?: string
}

/**
 * The "Who's in" list (S4.4): one card per current member, already sorted awaiting-first by
 * `buildRoster()`. A `<ul>`/`<li>` so a screen reader announces the count; no `<table>` — D42
 * settled that the row is a card, not a table cell. This story passes no `onAttendanceChange`, so
 * every control renders disabled; S4.5 supplies the handler and this component does not change.
 */
export function PlayerResponseList({
  rows,
  onAttendanceChange,
  savingUserIds,
  failedUserIds,
  disabledReason,
}: PlayerResponseListProps): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.userId} className="flex flex-col gap-1">
          <PlayerResponseCard
            row={row}
            onAttendanceChange={onAttendanceChange}
            saving={savingUserIds?.has(row.userId) ?? false}
            disabledReason={disabledReason}
          />
          {failedUserIds?.has(row.userId) && (
            <p role="alert" className="px-1 text-xs text-destructive">
              Couldn&apos;t save. Tap again.
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Five cards at the real height so the section does not jump when the roster resolves (AC11). */
export function PlayerResponseListSkeleton(): React.JSX.Element {
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
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="min-h-tap w-full rounded-lg" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
