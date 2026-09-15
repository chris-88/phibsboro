import { useState } from 'react'
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
import { FeedbackSheet } from '@/features/feedback/FeedbackSheet'
import { InstallSheet } from '@/features/install/install-sheet'
import { useInstallMenuItem } from '@/features/install/use-install-menu-item'

/**
 * The header overflow menu, rendered by AppShell on `chrome="nav"` routes only (AC17). "Send
 * feedback" (S12.2, any signed-in user), "Sign out" (S2.9) and, when relevant, S2.8's "Add to home
 * screen" — shown only to a non-installed player, opening the platform sheet (AC8). No submenu, no
 * settings or profile screen (Q11). The trigger is a 44px icon button (D40).
 */
export function AppShellMenu(): React.JSX.Element {
  const { signOut, isPending } = useSignOut()
  const session = useSession()
  const install = useInstallMenuItem()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  // Nothing to sign out of until the session has resolved.
  const disabled = session.status === 'loading' || isPending

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Menu">
            <EllipsisVertical className="size-5" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setFeedbackOpen(true)
            }}
          >
            Send feedback
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={disabled}
            onSelect={() => {
              void signOut()
            }}
          >
            Sign out
          </DropdownMenuItem>
          {install.visible && (
            <DropdownMenuItem
              onSelect={() => {
                install.open()
              }}
            >
              Add to home screen
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {install.visible && (
        <InstallSheet
          open={install.isOpen}
          onOpenChange={install.onOpenChange}
          variant={install.variant}
          promptInstall={install.promptInstall}
        />
      )}
    </>
  )
}
