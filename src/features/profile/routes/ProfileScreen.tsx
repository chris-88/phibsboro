import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSignedInUser } from '@/features/auth/use-current-user'
import { useSignOut } from '@/features/auth/use-sign-out'
import { FeedbackSheet } from '@/features/feedback/FeedbackSheet'
import { InstallSheet } from '@/features/install/install-sheet'
import { useInstallMenuItem } from '@/features/install/use-install-menu-item'
import { Avatar } from '@/features/profile/Avatar'

/**
 * The profile screen `/profile` (W9), reached from the header avatar. It carries the user's
 * essentials — avatar, name, phone, and their teams with each role — and the actions the old ⋮ menu
 * held: Send feedback, Add to home screen (when installable), and Sign out. Player stats/attendance
 * are deliberately not here (W8: a future Stats tab). The route is guarded `authed`, so a signed-in
 * user is guaranteed. Photo upload is added once Storage verifies the project's ES256 tokens.
 */
export default function ProfileScreen(): React.JSX.Element {
  const { name, phone, avatarPath, memberships } = useSignedInUser()
  const { signOut, isPending } = useSignOut()
  const install = useInstallMenuItem()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex flex-col items-center gap-3">
        <Avatar path={avatarPath} name={name} className="size-24 text-3xl" />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-foreground">{name}</h1>
          <p className="text-sm text-muted-foreground">{phone}</p>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Teams</h2>
        {memberships.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">You're on no teams yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memberships.map((m) => (
              <li
                key={m.teamId}
                className="flex items-center justify-between rounded-md border bg-card px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {m.teamName}
                </span>
                <Badge variant="secondary" className="shrink-0">
                  {m.role === 'manager' ? 'Manager' : 'Player'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setFeedbackOpen(true)
          }}
        >
          Send feedback
        </Button>
        {install.visible && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              install.open()
            }}
          >
            Add to home screen
          </Button>
        )}
        <Button
          variant="outline"
          className="w-full"
          disabled={isPending}
          onClick={() => {
            void signOut()
          }}
        >
          Sign out
        </Button>
      </section>

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      {install.visible && (
        <InstallSheet
          open={install.isOpen}
          onOpenChange={install.onOpenChange}
          variant={install.variant}
          promptInstall={install.promptInstall}
        />
      )}
    </div>
  )
}
