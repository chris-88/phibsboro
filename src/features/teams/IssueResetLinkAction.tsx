import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useIssueResetToken } from '@/api/reset'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { canIssueReset } from '@/features/teams/can-issue-reset'
import { CopyLinkField } from '@/features/teams/copy-link-field'
import type { MemberDirectoryRow } from '@/features/teams/schema'
import { resetUrl } from '@/lib/paths'

export interface IssueResetLinkActionProps {
  teamId: string
  member: MemberDirectoryRow
}

/**
 * The **Reset password** row action and the dialog it opens (S2.3). Mounted into the row-action
 * slot S6.4 leaves on each member card. It renders nothing when `canIssueReset` is false — the
 * predicate mirrors the `issue_reset_token` rule (D10) as convenience; RLS is the boundary.
 *
 * `team_member_directory` does not expose whether the target manages another team or is an admin,
 * so those inputs default to false and a manager sees the action on any player on their team. One
 * that the RPC then refuses fails cleanly as "You can't reset that person." — better than the
 * screen inventing authority (spec: the manager half).
 *
 * The menu item keeps the dropdown open on select (`preventDefault`) so this component — and its
 * dialog — stay mounted while the RPC is in flight and after it resolves; a select that closed the
 * menu would unmount the dialog before it could show. Closing the dialog drops the token from
 * memory: there is no re-copy path, by design (AC6).
 */
export function IssueResetLinkAction({
  teamId,
  member,
}: IssueResetLinkActionProps): React.JSX.Element | null {
  const account = useCurrentUser()
  const issue = useIssueResetToken()
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  if (account.status !== 'ready') return null
  const viewer = account.user
  const allowed = canIssueReset(
    // The directory cannot say these two; default false and let the RPC be the rule.
    { userId: member.user_id, role: member.role, isManagerElsewhere: false, isAdmin: false },
    { isAdmin: viewer.isAdmin, managesThisTeam: viewer.roleForTeam(teamId) === 'manager' },
  )
  if (!allowed) return null

  const firstName = member.name.trim().split(/\s+/)[0] ?? member.name

  function onSelect(): void {
    issue.mutate(
      { teamId, userId: member.user_id },
      {
        onSuccess: ({ token: fresh }) => {
          setToken(fresh)
          setOpen(true)
        },
      },
    )
  }

  return (
    <>
      <DropdownMenuItem
        // Keep the menu open so this subtree is not unmounted before the dialog can mount.
        onSelect={(e) => {
          e.preventDefault()
          onSelect()
        }}
        disabled={issue.isPending}
      >
        {issue.isPending ? 'Creating link…' : 'Reset password'}
      </DropdownMenuItem>

      {issue.isError && (
        <p role="alert" className="px-2 py-1 text-sm text-destructive">
          {issue.error.kind === 'not_authorised'
            ? "You can't reset that person."
            : "Couldn't create a link. Try again."}
        </p>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            // Drop the token from memory and clear any prior error (AC6).
            setToken(null)
            issue.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset {firstName}&apos;s password</DialogTitle>
            <DialogDescription>
              One use. Expires in 24 hours. Send it to {member.name} on WhatsApp.
            </DialogDescription>
          </DialogHeader>
          {token !== null && (
            <CopyLinkField url={resetUrl(token)} label="Reset link" copyLabel="Copy link" />
          )}
          <p className="text-sm text-muted-foreground">
            This link is only shown once. Close this and you&apos;ll need a new one.
          </p>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setOpen(false)
                setToken(null)
                issue.reset()
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
