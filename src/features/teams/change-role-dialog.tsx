import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MemberRole } from '@/features/teams/schema'

export interface ChangeRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberName: string
  teamName: string
  /** The role on this team now; preselected in the control (AC5). */
  currentRole: MemberRole
  /** True when this member is the team's only manager, so demoting them leaves none (AC7). */
  isOnlyManager: boolean
  pending: boolean
  errorText: string | null
  onSave: (role: MemberRole) => void
}

/**
 * The admin-only role control (AC5, AC6). Exactly two values — player and manager — because the
 * enum has no `admin` member and admin is not grantable through the app (D2). The current role is
 * preselected; Save is inert until the value actually changes. Demoting the only manager is
 * allowed and warns first (AC7). Optimistic in the hook, so the badge and sort move on Save and
 * revert on failure; a failure keeps the dialog open with the inline line.
 */
export function ChangeRoleDialog({
  open,
  onOpenChange,
  memberName,
  teamName,
  currentRole,
  isOnlyManager,
  pending,
  errorText,
  onSave,
}: ChangeRoleDialogProps): React.JSX.Element {
  const [role, setRole] = useState<MemberRole>(currentRole)

  // Reset the selection to the member's current role each time the dialog opens, so a cancelled
  // edit does not leak into the next one. Adjusting state during render on an open-edge change is
  // the React-recommended pattern (no effect, no cascading render).
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setRole(currentRole)
  }

  const demotingOnlyManager = isOnlyManager && currentRole === 'manager' && role === 'player'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change {memberName}&apos;s role</DialogTitle>
          <DialogDescription>
            Managers can create events, see everyone&apos;s answers and record attendance.
            {demotingOnlyManager && <> This leaves {teamName} with no manager.</>}
          </DialogDescription>
        </DialogHeader>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v as MemberRole)
          }}
          disabled={pending}
        >
          <SelectTrigger aria-label="Role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="player">Player</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || role === currentRole}
            onClick={() => {
              onSave(role)
            }}
          >
            {pending ? 'Working…' : 'Save'}
          </Button>
        </DialogFooter>
        {errorText !== null && (
          <p role="alert" className="text-sm text-destructive">
            {errorText}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
