import { useState } from 'react'
import { EllipsisVertical } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useRemoveMember,
  useSetMemberName,
  useSetMemberPhone,
  useSetMemberRole,
} from '@/api/members'
import { ChangeRoleDialog } from '@/features/teams/change-role-dialog'
import { CorrectNameDialog } from '@/features/teams/correct-name-dialog'
import { CorrectPhoneDialog } from '@/features/teams/correct-phone-dialog'
import { RemoveMemberDialog } from '@/features/teams/remove-member-dialog'
import type { MemberDirectoryRow, MemberRole } from '@/features/teams/schema'
import type { AppErrorCode } from '@/lib/errors'
import { formatEventTime } from '@/lib/time'

export interface MemberCardProps {
  teamId: string
  teamName: string
  member: MemberDirectoryRow
  /** The caller is a club admin. Change-role and correct-phone are admin only (D2, D51). */
  isAdmin: boolean
  /** Managers currently on the team, so the last-manager warning fires on the only one (AC7). */
  managerCount: number
  /**
   * The row-action slot (AC8). Empty in this story; S2.3 mounts the reset action here. A card with
   * an empty slot lays out unchanged, and the slot is only ever an item inside the action menu.
   */
  resetSlot?: React.ReactNode
}

type OpenDialog = 'remove' | 'role' | 'phone' | 'name' | null

/** Two overrides on the shared copy; the rest fall through to the generic line (S6.4 error map). */
function actionError(code: AppErrorCode): string {
  return code === 'not_authorised' ? "You can't do that." : "Couldn't do that. Try again."
}

/**
 * One member, as a card not a table row (D42). Line one: name with the role `Badge` and an
 * "Only manager" hint when it applies. Line two: phone and join date, muted. Line three: a 44px
 * action menu labelled with the member's name, holding only the actions the caller is permitted —
 * a disabled action the caller cannot use is never rendered, it is omitted (spec: Card). The menu
 * is the single home for actions, so a card with one action still uses it and the layout does not
 * shift between roles. Phone is nullable in the type on purpose (D8); a null renders as a dash.
 */
export function MemberCard({
  teamId,
  teamName,
  member,
  isAdmin,
  managerCount,
  resetSlot,
}: MemberCardProps): React.JSX.Element {
  const [open, setOpen] = useState<OpenDialog>(null)

  const remove = useRemoveMember(teamId)
  const setRole = useSetMemberRole(teamId)
  const setPhone = useSetMemberPhone(teamId)
  const setName = useSetMemberName()

  const [removeError, setRemoveError] = useState<string | null>(null)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [phoneTaken, setPhoneTaken] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  const isOnlyManager = member.role === 'manager' && managerCount === 1
  // A manager may remove only players; an admin may remove anyone. RLS enforces it regardless.
  const canRemove = isAdmin || member.role === 'player'
  const canChangeRole = isAdmin
  const canCorrectPhone = isAdmin
  // Name correction (S20.2, Z1) is always offered here: this list renders only to a manager of the
  // team or an admin, and both may correct a name — so the action menu is always present, and the
  // RPC enforces the permission regardless of what the UI shows.

  function confirmRemove(): void {
    setRemoveError(null)
    remove.mutate(
      { userId: member.user_id },
      {
        onSuccess: () => {
          setOpen(null)
        },
        onError: (err) => {
          setRemoveError(actionError(err.code))
        },
      },
    )
  }

  function saveRole(role: MemberRole): void {
    setRoleError(null)
    setRole.mutate(
      { userId: member.user_id, role },
      {
        onSuccess: () => {
          setOpen(null)
        },
        onError: (err) => {
          setRoleError(actionError(err.code))
        },
      },
    )
  }

  function savePhone(phone: string): void {
    setPhoneTaken(null)
    setPhone.mutate(
      { userId: member.user_id, phone },
      {
        onSuccess: () => {
          setOpen(null)
        },
        onError: (err) => {
          setPhoneTaken(
            err.code === 'phone_taken'
              ? 'That number is already registered to someone else.'
              : "Couldn't do that. Try again.",
          )
        },
      },
    )
  }

  function saveName(name: string): void {
    setNameError(null)
    setName.mutate(
      { userId: member.user_id, name },
      {
        onSuccess: () => {
          setOpen(null)
        },
        onError: (err) => {
          setNameError(actionError(err.code))
        },
      },
    )
  }

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{member.name}</span>
            <Badge variant={member.role === 'manager' ? 'default' : 'secondary'}>
              {member.role === 'manager' ? 'Manager' : 'Player'}
            </Badge>
            {isOnlyManager && <span className="text-xs text-muted-foreground">Only manager</span>}
          </div>
          <p className="text-sm break-all text-muted-foreground">
            {member.phone ?? '—'} · Joined {formatEventTime(member.joined_at, 'short')}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${member.name}`}
            >
              <EllipsisVertical aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canChangeRole && (
              <DropdownMenuItem
                onSelect={() => {
                  setOpen('role')
                }}
              >
                Change role
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                setOpen('name')
              }}
            >
              Correct name
            </DropdownMenuItem>
            {canCorrectPhone && (
              <DropdownMenuItem
                onSelect={() => {
                  setOpen('phone')
                }}
              >
                Correct phone
              </DropdownMenuItem>
            )}
            {resetSlot}
            {canRemove && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setOpen('remove')
                }}
              >
                Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>

      <RemoveMemberDialog
        open={open === 'remove'}
        onOpenChange={(o) => {
          setOpen(o ? 'remove' : null)
        }}
        memberName={member.name}
        teamName={teamName}
        leavesNoManager={isOnlyManager}
        pending={remove.isPending}
        errorText={removeError}
        onConfirm={confirmRemove}
      />
      {canChangeRole && (
        <ChangeRoleDialog
          open={open === 'role'}
          onOpenChange={(o) => {
            setOpen(o ? 'role' : null)
          }}
          memberName={member.name}
          teamName={teamName}
          currentRole={member.role}
          isOnlyManager={isOnlyManager}
          pending={setRole.isPending}
          errorText={roleError}
          onSave={saveRole}
        />
      )}
      <CorrectNameDialog
        open={open === 'name'}
        onOpenChange={(o) => {
          setOpen(o ? 'name' : null)
        }}
        currentName={member.name}
        pending={setName.isPending}
        errorText={nameError}
        onSave={saveName}
      />
      {canCorrectPhone && (
        <CorrectPhoneDialog
          open={open === 'phone'}
          onOpenChange={(o) => {
            setOpen(o ? 'phone' : null)
          }}
          memberName={member.name}
          currentPhone={member.phone}
          pending={setPhone.isPending}
          takenError={phoneTaken}
          onSave={savePhone}
        />
      )}
    </Card>
  )
}
