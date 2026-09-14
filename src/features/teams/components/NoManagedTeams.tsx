import { Link } from 'react-router'
import { EmptyState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { paths } from '@/lib/paths'

/**
 * The manage area's "no resolvable team" empty state (S6.3). Role-aware copy, kept here in
 * `teams/` so no Epic 4 screen has to branch on `isAdmin` to render it (AC9): an admin is sent to
 * `/admin` to make a team; a manager is told to ask an admin. Reused by `/manage` and
 * `/manage/event/new`.
 */
export function NoManagedTeams(): React.JSX.Element {
  const account = useCurrentUser()
  const isAdmin = account.status === 'ready' && account.user.isAdmin

  if (isAdmin) {
    return (
      <EmptyState
        title="No teams yet."
        body="Add your first team to get going."
        action={
          <Button asChild>
            <Link to={paths.admin()}>Add a team</Link>
          </Button>
        }
      />
    )
  }
  return <EmptyState title="You don't manage a team yet." body="Ask an admin to add you." />
}
