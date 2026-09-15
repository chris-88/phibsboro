import { ChevronRight, MessageSquare, Users } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { useTeams } from '@/api/teams'
import { CreateTeamForm } from '@/features/teams/create-team-form'
import { TeamRow } from '@/features/teams/team-row'
import type { Team } from '@/features/teams/schema'
import { paths } from '@/lib/paths'

/**
 * The `/admin` teams screen (S6.1). Admins create, rename, deactivate and reactivate teams;
 * a team is never deleted, only retired. The route is wrapped by S2.9's RequireAdmin; this
 * inline gate reads the same `useCurrentUser()` and is defence in depth. Convenience only. RLS
 * is the enforcement layer (S1.3, proved by S1.4).
 */
export default function AdminScreen(): React.JSX.Element {
  const account = useCurrentUser()

  // No flash of a redirect while the session and profile resolve (AC1).
  if (account.status === 'loading') {
    return (
      <div className="py-4">
        <LoadingState label="Checking access" />
      </div>
    )
  }
  // A signed-in non-admin (or an unauthenticated visitor) goes home, not to a broken screen.
  if (account.status !== 'ready' || !account.user.isAdmin) {
    return <Navigate to={paths.home()} replace />
  }

  return <AdminTeams />
}

function TeamList({ title, teams }: { title: string; teams: Team[] }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="flex flex-col">
        {teams.map((team) => (
          <TeamRow key={team.id} team={team} />
        ))}
      </ul>
    </section>
  )
}

function AdminTeams(): React.JSX.Element {
  const teams = useTeams()
  const isEmpty = teams.isSuccess && teams.data.length === 0
  const active = teams.data?.filter((t) => t.active) ?? []
  const inactive = teams.data?.filter((t) => !t.active) ?? []

  return (
    <div className="flex flex-col gap-4 py-4">
      {isEmpty && <EmptyState title="No teams yet." body="Add your first team below." />}

      {/* The admin repair tools (S12.3 feedback, S14.2 users) live under Admin. */}
      <Link
        to={paths.adminUsers()}
        className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Users className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-medium text-foreground">Users</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
      <Link
        to={paths.adminFeedback()}
        className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <MessageSquare className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 font-medium text-foreground">Feedback</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add a team</CardTitle>
        </CardHeader>
        <CardContent>
          {/* The form stays usable in every list state, including while the list loads. */}
          <CreateTeamForm autoFocus={isEmpty} />
        </CardContent>
      </Card>

      {teams.isPending && <LoadingState rows={3} label="Loading teams" />}

      {teams.isError && (
        <ErrorState
          title="Couldn't load teams."
          onRetry={() => {
            void teams.refetch()
          }}
        />
      )}

      {teams.isSuccess && active.length > 0 && <TeamList title="Active" teams={active} />}

      {teams.isSuccess && inactive.length > 0 && (
        <section className="flex flex-col gap-1">
          <TeamList title="Inactive" teams={inactive} />
          {/* AC9: no delete control anywhere; say so rather than leave a reader wondering. */}
          <p className="px-1 pt-1 text-xs text-muted-foreground">
            Deactivated teams are kept, never deleted, so their history stays.
          </p>
        </section>
      )}
    </div>
  )
}
