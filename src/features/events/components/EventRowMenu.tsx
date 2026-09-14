import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { CancelEventDialog } from '@/features/events/components/CancelEventDialog'
import { DeleteEventDialog } from '@/features/events/components/DeleteEventDialog'
import { EventFormDialog } from '@/features/events/components/EventFormDialog'
import type { EventActionData } from '@/features/events/schema'
import { serverNow } from '@/lib/serverClock'

type OpenDialog = 'edit' | 'cancel' | 'reinstate' | 'delete' | null

export interface EventRowMenuProps {
  event: EventActionData
  /** The event's team name, for the read-only Team field in the edit dialog (AC2). */
  teamName: string
  /** Called after a successful delete, forwarded to the delete dialog (S4.3 handover). */
  onDeleted?: () => void
}

/**
 * The overflow menu on a manager's event row (S4.2). Which items show is decided from `status`,
 * `starts_at` and `isAdmin`, against `serverNow()` — never the device clock, so a wrong phone
 * clock cannot reveal or hide an action (D48, AC8). These are convenience checks; RLS decides for
 * real, refusing a non-admin delete or an unmanaged-team edit with zero rows (S1.4).
 *
 * Menu rules:
 *   Edit       — always (a manager of the team)
 *   Cancel     — status === 'scheduled'
 *   Reinstate  — status === 'cancelled' && starts_at > now
 *   Delete     — isAdmin
 */
export function EventRowMenu({ event, teamName, onDeleted }: EventRowMenuProps): React.JSX.Element {
  const account = useCurrentUser()
  const isAdmin = account.status === 'ready' && account.user.isAdmin
  const [dialog, setDialog] = useState<OpenDialog>(null)

  const scheduled = event.status === 'scheduled'
  const future = new Date(event.starts_at).getTime() > serverNow().getTime()
  const canReinstate = event.status === 'cancelled' && future

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="m-1 shrink-0 self-center"
            aria-label={`Actions for ${event.title}`}
          >
            <MoreVertical className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              setDialog('edit')
            }}
          >
            Edit
          </DropdownMenuItem>
          {scheduled && (
            <DropdownMenuItem
              onSelect={() => {
                setDialog('cancel')
              }}
            >
              Cancel
            </DropdownMenuItem>
          )}
          {canReinstate && (
            <DropdownMenuItem
              onSelect={() => {
                setDialog('reinstate')
              }}
            >
              Reinstate
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setDialog('delete')
                }}
              >
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EventFormDialog
        event={event}
        teamName={teamName}
        open={dialog === 'edit'}
        onOpenChange={(o) => {
          if (!o) setDialog(null)
        }}
      />
      <CancelEventDialog
        event={event}
        to="cancelled"
        open={dialog === 'cancel'}
        onOpenChange={(o) => {
          if (!o) setDialog(null)
        }}
      />
      <CancelEventDialog
        event={event}
        to="scheduled"
        open={dialog === 'reinstate'}
        onOpenChange={(o) => {
          if (!o) setDialog(null)
        }}
      />
      {isAdmin && (
        <DeleteEventDialog
          event={event}
          open={dialog === 'delete'}
          onDeleted={onDeleted}
          onOpenChange={(o) => {
            if (!o) setDialog(null)
          }}
        />
      )}
    </>
  )
}
