import { cn } from 'cn'
import { useCallback, useMemo, useState } from 'react'
import { useMonthAvailableCounts, useMonthEvents, useUpcomingEvents } from '@/api/events'
import { useTeams } from '@/api/teams'
import { EmptyState, ErrorState } from '@/components/states'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { useSignedInUser } from '@/features/auth/use-current-user'
import {
  dateOfDayKey,
  dayKeyOfDate,
  dublinDayKey,
  groupEventsByDay,
  monthDate,
  monthKeyOfDay,
  summariseDay,
  todayDayKey,
} from '@/features/events/calendar-month'
import { CalendarDayDots } from '@/features/events/components/CalendarDayDots'
import { CalendarHomeSkeleton } from '@/features/events/components/CalendarHomeSkeleton'
import { DayEventCard } from '@/features/events/components/DayEventCard'
import { NextEventCard } from '@/features/events/components/NextEventCard'
import { PostResponsePrompts } from '@/features/events/components/PostResponsePrompts'
import { pickNextEvent } from '@/features/events/pick-next-event'
import { TEAM_COLOUR_DEFAULT } from '@/features/teams/palette'
import { formatEventTime } from '@/lib/time'

/** The states the calendar home resolves to, one discriminated value so S7.1's audit reads them
 *  off a single switch (matches the pre-calendar home's shape). `noTeam` never applies to an admin
 *  (S11.2) — a membership-less admin still gets the all-teams calendar. */
type HomeState = 'noTeam' | 'loading' | 'error' | 'ready'

/**
 * The player home `/` becomes a month calendar (S10.2, V10): a condensed next-event card on top
 * (S3.1, the shared YES / NO kept), a month grid with a team-coloured dot per event per day (S10.1
 * colours; cancelled → hollow/grey), and the selected day's events beneath as cards with the same
 * one-tap response and the S3.4 cut-off. The v1.0.0 chronological upcoming list is replaced.
 *
 * Two reads feed it: `useUpcomingEvents` for the soonest event in the card (any month), and
 * `useMonthEvents` for the visible month's grid and day list; `useTeams` supplies the dot colours.
 * The selected day and visible month are UI state, seeded once from the next event so a player who
 * opens the app lands on their next fixture's day rather than an empty today.
 */
export default function HomeScreen(): React.JSX.Element {
  const { memberships, isAdmin, administrableTeams } = useSignedInUser()
  const multiTeam = memberships.length > 1
  // An admin sees every active team's events (V14, S11.1), so a team name is worth showing whenever
  // more than one team is in view; a player still only sees their own teams.
  const listShowTeamName = isAdmin ? administrableTeams.length > 1 : multiTeam
  // The teams the viewer plays for — a manage row is any event on a team NOT in this set, for an
  // admin (S11.2). For a player this is all their teams, so no event is ever a manage row.
  const memberTeamIds = useMemo(() => new Set(memberships.map((m) => m.teamId)), [memberships])

  const upcoming = useUpcomingEvents()
  // The awaiting-only top card (V13) is driven by the admin's own memberships, never by teams they
  // merely administer (S11.2 AC4): an admin's all-teams `upcoming` is filtered to member teams
  // before picking. For a player this filter is the identity — `upcoming` is already their teams —
  // so the player path is byte-for-byte unchanged.
  const myUpcoming = useMemo(
    () => (upcoming.data ?? []).filter((e) => memberTeamIds.has(e.teamId)),
    [upcoming.data, memberTeamIds],
  )
  const next = pickNextEvent(myUpcoming)

  // The selected day and visible month are UI state, held as user overrides (null until the player
  // taps a day or pages a month). The default is derived, not stored, so no effect writes state:
  // today, or the next event's day once it loads (default: today, or the next event's day if today
  // is empty). A user gesture takes over from the default and a late read never yanks it back.
  const [userSelected, setUserSelected] = useState<string | null>(null)
  const [userMonth, setUserMonth] = useState<string | null>(null)

  const defaultDay = next ? dublinDayKey(next.startsAt) : todayDayKey()
  const selectedKey = userSelected ?? defaultDay
  const monthKey = userMonth ?? monthKeyOfDay(selectedKey)

  const month = useMonthEvents(monthKey)
  const teams = useTeams()

  const colourForTeam = useCallback(
    (teamId: string): string =>
      (teams.data ?? []).find((t) => t.id === teamId)?.colour ?? TEAM_COLOUR_DEFAULT,
    [teams.data],
  )

  const monthEvents = useMemo(() => month.data ?? [], [month.data])
  const byDay = useMemo(() => groupEventsByDay(monthEvents), [monthEvents])

  // The available-response counts for the admin's manage rows (S11.2). Admin-only: disabled for a
  // player, so no extra request fires and the player path is unchanged. `null` while it loads,
  // which `DayEventCard` renders as a plain "Manage" affordance until the count arrives.
  const monthEventIds = useMemo(() => monthEvents.map((e) => e.id), [monthEvents])
  const counts = useMonthAvailableCounts(monthKey, monthEventIds, isAdmin)
  const availableCountFor = useCallback(
    (eventId: string): number | null => (counts.data ? (counts.data.get(eventId) ?? 0) : null),
    [counts.data],
  )

  // The day cell: the shared calendar button plus this day's dots. Memoised on its inputs so react
  // -day-picker does not remount every cell each render.
  const DayButton = useMemo(() => {
    function HomeDayButton(props: React.ComponentProps<typeof CalendarDayButton>) {
      const events = byDay.get(dayKeyOfDate(props.day.date))
      const summary = events ? summariseDay(events, colourForTeam) : null
      const selected = props.modifiers.selected
      const today = props.modifiers.today
      return (
        <CalendarDayButton {...props}>
          {/* The number sits in a compact chip pinned to the top of the cell (V13, Chris's feedback):
              the selected/today highlight hugs the number instead of filling the dot-stretched cell,
              and a fixed-height dots row below keeps every day's number on the same line. */}
          <span
            className={cn(
              'flex size-7 items-center justify-center rounded-full text-sm',
              selected
                ? 'bg-primary font-medium text-primary-foreground'
                : today
                  ? 'bg-muted text-foreground'
                  : '',
            )}
          >
            {props.children}
          </span>
          <span className="flex h-2 items-center justify-center">
            {summary && <CalendarDayDots summary={summary} />}
          </span>
        </CalendarDayButton>
      )
    }
    return HomeDayButton
  }, [byDay, colourForTeam])

  const state: HomeState =
    !isAdmin && memberships.length === 0
      ? 'noTeam'
      : upcoming.isError || month.isError || teams.isError
        ? 'error'
        : !(upcoming.isSuccess && month.isSuccess && teams.isSuccess)
          ? 'loading'
          : 'ready'

  const selectedEvents = byDay.get(selectedKey) ?? []

  return (
    <div className="py-4">
      <h1 className="sr-only">Home</h1>

      {state === 'noTeam' && (
        <EmptyState title="You're not on a team yet." body="Ask your manager for a join link." />
      )}

      {state === 'loading' && <CalendarHomeSkeleton />}

      {state === 'error' && (
        <ErrorState
          title="Couldn't load your events."
          onRetry={() => {
            if (upcoming.isError) void upcoming.refetch()
            if (month.isError) void month.refetch()
            if (teams.isError) void teams.refetch()
          }}
        />
      )}

      {state === 'ready' && (
        <div className="flex flex-col gap-3">
          {/* Only the soonest UNANSWERED event gets the prominent card; once answered it hides and
              the calendar rises to the top (V13, Chris's feedback). No card when nothing is awaiting. */}
          {next && (
            <>
              <NextEventCard event={next} showTeamName={multiTeam} condensed />
              {/* One seam for S2.7 and S2.8; returns null in this story (D46). */}
              <PostResponsePrompts />
            </>
          )}

          {/* Compressed so the selected day's list starts above the fold (V13). */}
          <Card>
            <CardContent className="p-2">
              <Calendar
                mode="single"
                required
                month={monthDate(monthKey)}
                onMonthChange={(d) => {
                  setUserMonth(monthKeyOfDay(dayKeyOfDate(d)))
                }}
                selected={dateOfDayKey(selectedKey)}
                onSelect={(d) => {
                  setUserSelected(dayKeyOfDate(d))
                }}
                showOutsideDays
                className="[--cell-size:--spacing(9)]"
                classNames={{ root: 'w-full' }}
                components={{ DayButton }}
              />
            </CardContent>
          </Card>

          {/* Tied to the calendar selection: a heading names the chosen day so it is obvious these
              are that day's events (V13). */}
          <h2 className="px-1 text-sm font-semibold text-foreground">
            {formatEventTime(dateOfDayKey(selectedKey).toISOString(), 'day')}
          </h2>
          {monthEvents.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              {isAdmin ? 'No events this month.' : 'Nothing this month.'}
            </p>
          ) : selectedEvents.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">Nothing on this day.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map((event) => {
                // An admin viewing a team they don't play for gets a manage row (counts →
                // manager view); an own-team event, or any player's event, stays the player row.
                const manage = isAdmin && !memberTeamIds.has(event.teamId)
                return (
                  <DayEventCard
                    key={event.id}
                    event={event}
                    showTeamName={listShowTeamName}
                    manage={manage}
                    availableCount={manage ? availableCountFor(event.id) : undefined}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
