import { useUpcomingEvents } from '@/api/events'
import { EmptyState, ErrorState } from '@/components/states'
import { useSignedInUser } from '@/features/auth/use-current-user'
import { NextEventCard } from '@/features/events/components/NextEventCard'
import { NextEventCardSkeleton } from '@/features/events/components/NextEventCardSkeleton'
import { PostResponsePrompts } from '@/features/events/components/PostResponsePrompts'
import { pickNextEvent } from '@/features/events/pick-next-event'

/** The five states of the home card, as one discriminated value so S7.1's audit reads them off a
 *  single switch rather than a chain of ternaries. */
type HomeState = 'noTeam' | 'loading' | 'error' | 'noEvents' | 'ready'

/**
 * The player home `/` (S3.1), inside the app shell and its bottom nav (D41 — the shell is supplied
 * by RootLayout, so this screen renders content only). One prominent card: the soonest scheduled
 * event across every team the player is on (D22, D60), with the shared YES / NO buttons. Two empty
 * states — no team, and nothing coming up — plus a skeleton and an inline error.
 *
 * `useSignedInUser()` is safe here: the route is guarded `authed`, so this only renders once the
 * account is ready. `noTeam` is decided before `loading` because with no memberships the query is
 * disabled and would otherwise sit pending for ever.
 */
export default function HomeScreen(): React.JSX.Element {
  const { memberships } = useSignedInUser()
  const query = useUpcomingEvents()
  const next = query.data ? pickNextEvent(query.data) : null

  const state: HomeState =
    memberships.length === 0
      ? 'noTeam'
      : query.isError
        ? 'error'
        : !query.isSuccess
          ? 'loading'
          : next === null
            ? 'noEvents'
            : 'ready'

  return (
    <div className="py-4">
      <h1 className="sr-only">Home</h1>
      {state === 'loading' && <NextEventCardSkeleton />}
      {state === 'error' && (
        <ErrorState
          title="Couldn't load your events."
          onRetry={() => {
            void query.refetch()
          }}
        />
      )}
      {state === 'noTeam' && (
        <EmptyState title="You're not on a team yet." body="Ask your manager for a join link." />
      )}
      {state === 'noEvents' && (
        <EmptyState title="Nothing coming up." body="Your manager will post the next one here." />
      )}
      {state === 'ready' && next !== null && (
        <>
          <NextEventCard event={next} showTeamName={memberships.length > 1} />
          {/* One seam for S2.7 and S2.8; returns null in this story (D46). */}
          <PostResponsePrompts />
        </>
      )}
      {/* S3.2 mounts <UpcomingEventsList /> here. */}
    </div>
  )
}
