import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { Team } from '@/features/teams/schema'

export interface DeactivateTeamDialogProps {
  team: Team
  disabled?: boolean
  onConfirm: () => void
}

/**
 * Deactivating is confirmed before it applies (S6.1 AC6): the dialog names the team and states
 * what deactivation does. Cancel changes nothing; Confirm calls `onConfirm`, which sets
 * `active = false`. Reactivating is one tap with no dialog and lives in the row, not here.
 */
export function DeactivateTeamDialog({
  team,
  disabled = false,
  onConfirm,
}: DeactivateTeamDialogProps): React.JSX.Element {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={disabled}>
          Deactivate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {team.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            No new events can be created and its join links stop working. Existing events,
            availability and attendance stay. You can reactivate it any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Deactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
