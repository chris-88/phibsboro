import { EllipsisVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession } from '@/features/auth/session-context'
import { useSignOut } from '@/features/auth/use-sign-out'

/**
 * The header overflow menu, rendered by AppShell on `chrome="nav"` routes only (AC17). One item
 * in v1 — "Sign out" — joined later by S2.8's "Add to home screen". No submenu, no settings or
 * profile screen (Q11). The trigger is a 44px icon button (D40).
 */
export function AppShellMenu(): React.JSX.Element {
  const { signOut, isPending } = useSignOut()
  const session = useSession()
  // Nothing to sign out of until the session has resolved.
  const disabled = session.status === 'loading' || isPending

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu">
          <EllipsisVertical className="size-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={disabled}
          onSelect={() => {
            void signOut()
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
