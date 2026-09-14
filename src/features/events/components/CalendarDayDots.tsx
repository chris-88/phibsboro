import type { DaySummary } from '@/features/events/calendar-month'

/**
 * The dots under a calendar day number (S10.2): one per event in that event's team colour (S10.1),
 * up to three, then a `+n` overflow. A cancelled event is a hollow grey ring, not a filled dot
 * (AC5). The colour is a data-driven inline style — the value is a team's stored hex, never a
 * source literal — so a filled dot reads in the team's own colour without a token per team.
 */
export function CalendarDayDots({ summary }: { summary: DaySummary }): React.JSX.Element {
  return (
    <span className="flex items-center justify-center gap-0.5" aria-hidden="true">
      {summary.dots.map((dot, i) =>
        dot.cancelled ? (
          <span
            key={i}
            className="size-1.5 rounded-full border border-muted-foreground bg-transparent"
          />
        ) : (
          <span key={i} className="size-1.5 rounded-full" style={{ backgroundColor: dot.colour }} />
        ),
      )}
      {summary.overflow > 0 && (
        <span className="text-[0.6rem] leading-none text-muted-foreground">
          +{summary.overflow}
        </span>
      )}
    </span>
  )
}
