import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateTeamInvite, useRevokeTeamInvite, useTeamInvite } from '@/api/invites'
import { ConfirmLinkDialog } from '@/features/teams/confirm-link-dialog'
import { CopyLinkField } from '@/features/teams/copy-link-field'
import type { MemberRole } from '@/features/teams/schema'
import { mapRpcError, type AppErrorCode } from '@/lib/errors'
import { joinUrl, paths } from '@/lib/paths'
import { formatEventTime } from '@/lib/time'

export interface JoinLinkPanelProps {
  teamId: string
  role: MemberRole
  /** From the teams cache. When false the team is retired: create and regenerate are disabled. */
  teamActive: boolean
  /** Convenience only, for the reactivate hint's admin link. RLS is the boundary (S1.4). */
  isAdmin: boolean
}

const REACTIVATE_LINE = 'Reactivate this team to issue join links'
const CONFIRM_FAIL = "Couldn't do that. Try again."

/** One code carries copy worth overriding; the rest fall through to the shared line (S6.2). */
const copyFor = (code: AppErrorCode, role: MemberRole): string =>
  code !== 'not_authorised'
    ? mapRpcError(code)
    : role === 'manager'
      ? 'Only an admin can create a manager link.'
      : "You can't manage this team."

/**
 * The squad or manager join-link panel (S6.2). One component, `role` a prop: the manager
 * variant is a second instance with its own heading, copy and gate, rendered only for an admin.
 * All four states are handled — a skeleton while the invite loads, an inline retry on failure,
 * an empty state with a single Create button, and the populated link with Copy, Regenerate
 * (player only) and Revoke. Tokens never leave this component's props; nothing here logs.
 */
export function JoinLinkPanel({
  teamId,
  role,
  teamActive,
  isAdmin,
}: JoinLinkPanelProps): React.JSX.Element {
  const invite = useTeamInvite(teamId, role)
  const create = useCreateTeamInvite(teamId)
  const revoke = useRevokeTeamInvite(teamId)

  const [createError, setCreateError] = useState<string | null>(null)
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenError, setRegenError] = useState<string | null>(null)
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const isManagerLink = role === 'manager'
  const heading = isManagerLink ? 'Manager link' : 'Join link'
  const emptyTitle = isManagerLink ? 'No manager link.' : 'No join link yet.'
  const createLabel = isManagerLink ? 'Create manager link' : 'Create join link'

  function runCreate(): void {
    setCreateError(null)
    create.mutate(role, {
      onError: (err) => {
        setCreateError(copyFor(err.code, role))
      },
    })
  }

  function openRegen(): void {
    setRegenError(null)
    setRegenOpen(true)
  }

  function confirmRegen(): void {
    setRegenError(null)
    create.mutate(role, {
      onSuccess: () => {
        setRegenOpen(false)
      },
      onError: () => {
        setRegenError(CONFIRM_FAIL)
      },
    })
  }

  function openRevoke(): void {
    setRevokeError(null)
    setRevokeOpen(true)
  }

  function confirmRevoke(): void {
    setRevokeError(null)
    revoke.mutate(role, {
      onSuccess: () => {
        setRevokeOpen(false)
      },
      onError: () => {
        setRevokeError(CONFIRM_FAIL)
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {invite.isPending && <Skeleton className="h-40 w-full" />}

        {invite.isError && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-destructive">Couldn&apos;t load the join link.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                void invite.refetch()
              }}
            >
              Try again
            </Button>
          </div>
        )}

        {invite.isSuccess && invite.data === null && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{emptyTitle}</p>
            <Button
              type="button"
              className="self-start"
              disabled={!teamActive || create.isPending}
              onClick={runCreate}
            >
              {createLabel}
            </Button>
            {!teamActive && <ReactivateHint isAdmin={isAdmin} />}
            {createError !== null && teamActive && (
              <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <span>{createError}</span>
                <Button type="button" variant="ghost" size="xs" onClick={runCreate}>
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

        {invite.isSuccess && invite.data !== null && (
          <div className="flex flex-col gap-3">
            <CopyLinkField url={joinUrl(invite.data.token)} label={`${heading} URL`} />

            {isManagerLink ? (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p>Single use. {expiryText(invite.data.expires_at)}.</p>
                <p>Send it to one person, not the squad group.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <p>Anyone with this link can join as a player.</p>
                <p>{expiryText(invite.data.expires_at)}.</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {!isManagerLink && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!teamActive}
                  onClick={openRegen}
                >
                  Regenerate
                </Button>
              )}
              <Button type="button" variant="destructive" size="sm" onClick={openRevoke}>
                Revoke
              </Button>
            </div>
            {!teamActive && <ReactivateHint isAdmin={isAdmin} />}
          </div>
        )}
      </CardContent>

      <ConfirmLinkDialog
        open={regenOpen}
        onOpenChange={setRegenOpen}
        title="Regenerate the join link?"
        description="The old link stops working immediately, including links already sitting in WhatsApp. Anyone using it will need the new one."
        confirmLabel="Regenerate"
        pending={create.isPending}
        errorText={regenError}
        onConfirm={confirmRegen}
      />
      <ConfirmLinkDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revoke the join link?"
        description="The link stops working immediately, including links already sitting in WhatsApp. Members who already joined keep their place."
        confirmLabel="Revoke"
        pending={revoke.isPending}
        errorText={revokeError}
        onConfirm={confirmRevoke}
      />
    </Card>
  )
}

/** Player and manager links always carry an expiry; a null renders as "No expiry" rather than
 *  "Invalid Date" (S6.2 gotcha), never through an ad-hoc formatter (AC5). */
function expiryText(expiresAt: string | null): string {
  return expiresAt === null ? 'No expiry' : `Expires ${formatEventTime(expiresAt, 'short')}`
}

function ReactivateHint({ isAdmin }: { isAdmin: boolean }): React.JSX.Element {
  return (
    <p className="text-sm text-muted-foreground">
      {REACTIVATE_LINE}
      {isAdmin && (
        <>
          {' — '}
          <Link to={paths.admin()} className="text-primary underline-offset-4 hover:underline">
            open Admin
          </Link>
        </>
      )}
      .
    </p>
  )
}
