import { useState } from 'react'
import { toast } from 'sonner'
import { useAdminDeleteUser, type AdminUser } from '@/api/admin-users'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface DeleteUserDialogProps {
  user: AdminUser
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The admin hard-delete of a whole person (S18.2). Far more destructive than removing a membership:
 * it deletes the auth account and cascades away their profile and every row keyed on it — every
 * team, response, attendance, squad pick, match stat and piece of feedback. Like the event delete
 * (S4.2), the only undo is typing the name exactly, so the confirm stays disabled until it matches.
 * The RPC refuses a non-admin and self-deletion; this is the UI in front of it.
 */
export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
}: DeleteUserDialogProps): React.JSX.Element {
  const del = useAdminDeleteUser()
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const matches = typed === user.name

  const confirm = (): void => {
    if (!matches) return
    setError(null)
    del.mutate(
      { userId: user.id },
      {
        onSuccess: () => {
          toast(`${user.name} deleted.`)
          onOpenChange(false)
        },
        onError: () => {
          setError("That didn't work. You can't delete this person.")
        },
      },
    )
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTyped('')
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {user.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes their account and everything tied to it — every team, response,
            attendance and stat. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-user-confirm">Type the name to confirm</Label>
          <Input
            id="delete-user-confirm"
            value={typed}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={del.isPending}
            onChange={(e) => {
              setTyped(e.target.value)
            }}
          />
        </div>

        {error != null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={del.isPending}>Keep it</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={!matches || del.isPending}>
            {del.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
