import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTeamMembers } from '@/api/members'
import { MemberCard } from '@/features/teams/member-card'

export interface MemberListProps {
  teamId: string
  /** Named in the last-manager confirmation line (AC7); comes from the teams cache. */
  teamName: string
  /** Caller is a club admin: enables the change-role and correct-phone actions (D2, D51). */
  isAdmin: boolean
}

/**
 * The squad list below the join-link panel (S6.4). All four states (D49): four skeleton cards
 * while it loads, an empty line with the panel above left usable, an inline retry on failure that
 * leaves the panel untouched, and one `MemberCard` per member — managers first, then players,
 * already sorted by `useTeamMembers`. `managerCount` is derived here and passed down so the
 * only-manager warning fires without a second query (the one-query-per-screen rule).
 */
export function MemberList({ teamId, teamName, isAdmin }: MemberListProps): React.JSX.Element {
  const members = useTeamMembers(teamId)

  if (members.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (members.isError) {
    return (
      <div role="alert" className="flex flex-col gap-2">
        <p className="text-sm text-destructive">Couldn&apos;t load the squad.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => {
            void members.refetch()
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (members.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No one has joined this team yet.</p>
  }

  const managerCount = members.data.filter((m) => m.role === 'manager').length

  return (
    <div className="flex flex-col gap-2">
      {members.data.map((member) => (
        <MemberCard
          key={member.user_id}
          teamId={teamId}
          teamName={teamName}
          member={member}
          isAdmin={isAdmin}
          managerCount={managerCount}
        />
      ))}
    </div>
  )
}
