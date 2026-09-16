import { useMemo, useState } from 'react'
import { Navigate } from 'react-router'
import {
  useAdminRemoveMembership,
  useAdminSetAdmin,
  useAdminSetMembership,
  useAllUsers,
  type AdminUser,
} from '@/api/admin-users'
import { useTeams } from '@/api/teams'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DeleteUserDialog } from '@/features/admin/DeleteUserDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { type MemberRole } from '@/features/teams/schema'
import { paths } from '@/lib/paths'

const ROLE_LABEL: Record<MemberRole, string> = { player: 'Player', manager: 'Manager' }

/**
 * The admin user manager `/admin/users` (S14.2, W6; S18.2). Every person, the teams and roles they
 * hold, and the god-mode actions: assign to a team, change a role, remove, promote/demote another
 * admin, and fully delete a person — the repair tool for when a normal path can't fix it.
 * Admin-guarded (S2.9) + inline gate; RLS is the boundary. Reads and writes go through `useAllUsers`
 * / `admin_set_membership` / `remove_member` / `admin_set_admin` / `admin_delete_user`.
 */
export default function AdminUsersScreen(): React.JSX.Element {
  const account = useCurrentUser()

  if (account.status === 'loading') {
    return (
      <div className="py-4">
        <LoadingState label="Checking access" />
      </div>
    )
  }
  if (account.status !== 'ready' || !account.user.isAdmin) {
    return <Navigate to={paths.home()} replace />
  }
  return <Users currentUserId={account.user.id} />
}

function Users({ currentUserId }: { currentUserId: string }): React.JSX.Element {
  const users = useAllUsers()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return users.data ?? []
    return (users.data ?? []).filter((u) => u.name.toLowerCase().includes(q) || u.phone.includes(q))
  }, [users.data, query])

  return (
    <div className="flex flex-col gap-4 py-4">
      <h1 className="px-1 text-lg font-semibold text-foreground">Users</h1>

      {users.isPending && <LoadingState rows={4} label="Loading users" />}

      {users.isError && (
        <ErrorState
          title="Couldn't load users."
          onRetry={() => {
            void users.refetch()
          }}
        />
      )}

      {users.isSuccess &&
        (users.data.length === 0 ? (
          <EmptyState title="No users yet." />
        ) : (
          <>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Search by name or number"
              aria-label="Search users"
            />
            {filtered.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">No one matches that.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {filtered.map((user) => (
                  <li key={user.id}>
                    <UserCard user={user} isSelf={user.id === currentUserId} />
                  </li>
                ))}
              </ul>
            )}
          </>
        ))}
    </div>
  )
}

function UserCard({ user, isSelf }: { user: AdminUser; isSelf: boolean }): React.JSX.Element {
  const setMembership = useAdminSetMembership()
  const removeMembership = useAdminRemoveMembership()
  const setAdmin = useAdminSetAdmin()
  const teams = useTeams()
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [addTeamId, setAddTeamId] = useState('')
  const [addRole, setAddRole] = useState<MemberRole>('player')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const memberTeamIds = new Set(user.memberships.map((m) => m.teamId))
  // Only active teams the user is not already on can be added (the RPC accepts inactive too, but
  // the everyday picker stays active-only, D50).
  const addableTeams = (teams.data ?? []).filter((t) => t.active && !memberTeamIds.has(t.id))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="min-w-0 truncate">{user.name}</span>
          {user.isAdmin && (
            <Badge variant="secondary" className="shrink-0">
              Admin
            </Badge>
          )}
          {isSelf && (
            <span className="shrink-0 text-xs font-normal text-muted-foreground">You</span>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{user.phone}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {user.memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">No teams.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {user.memberships.map((m) => (
              <li key={m.teamId} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {m.teamName}
                </span>
                <Select
                  value={m.role}
                  onValueChange={(role) => {
                    setMembership.mutate({
                      teamId: m.teamId,
                      userId: user.id,
                      role: role as MemberRole,
                    })
                  }}
                >
                  <SelectTrigger className="w-32" aria-label={`Role on ${m.teamName}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
                {confirmRemove === m.teamId ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      removeMembership.mutate({ teamId: m.teamId, userId: user.id })
                      setConfirmRemove(null)
                    }}
                  >
                    Confirm
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConfirmRemove(m.teamId)
                    }}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {addableTeams.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Select value={addTeamId} onValueChange={setAddTeamId}>
              <SelectTrigger className="min-w-40 flex-1" aria-label={`Add ${user.name} to a team`}>
                <SelectValue placeholder="Add to team…" />
              </SelectTrigger>
              <SelectContent>
                {addableTeams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={addRole}
              onValueChange={(r) => {
                setAddRole(r as MemberRole)
              }}
            >
              <SelectTrigger className="w-32" aria-label="Role to add">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="player">Player</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={addTeamId === ''}
              onClick={() => {
                setMembership.mutate(
                  { teamId: addTeamId, userId: user.id, role: addRole },
                  {
                    onSuccess: () => {
                      setAddTeamId('')
                    },
                  },
                )
              }}
            >
              Add
            </Button>
          </div>
        )}

        {/* God-mode actions on the whole person (S18.2), never on the admin's own row: promote or
            demote another admin, and the hard delete behind a type-the-name confirm. */}
        {!isSelf && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              disabled={setAdmin.isPending}
              onClick={() => {
                setAdmin.mutate({ userId: user.id, isAdmin: !user.isAdmin })
              }}
            >
              {user.isAdmin ? 'Remove admin' : 'Make admin'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="ml-auto"
              onClick={() => {
                setDeleteOpen(true)
              }}
            >
              Delete user…
            </Button>
          </div>
        )}

        {(setMembership.isError || removeMembership.isError || setAdmin.isError) && (
          <p className="text-sm text-destructive" aria-live="polite">
            That change didn't save. Try again.
          </p>
        )}
        {user.memberships.length > 0 && (
          <p className="sr-only">
            {user.name} is a{' '}
            {user.memberships.map((m) => `${ROLE_LABEL[m.role]} of ${m.teamName}`).join(', ')}
          </p>
        )}
      </CardContent>
      {!isSelf && <DeleteUserDialog user={user} open={deleteOpen} onOpenChange={setDeleteOpen} />}
    </Card>
  )
}
