import { Link } from 'react-router'
import { Avatar } from '@/features/profile/Avatar'
import { useCurrentUser } from '@/features/auth/use-current-user'
import { paths } from '@/lib/paths'

/**
 * The header affordance on every `nav` route (W9), in place of the old ⋮ menu: the signed-in user's
 * avatar, linking to `/profile` where the menu's actions now live. A 44px hit area around the
 * circle. While the account resolves it shows a neutral initials-less circle, replaced the moment
 * the user is ready.
 */
export function ProfileButton(): React.JSX.Element {
  const account = useCurrentUser()
  const name = account.status === 'ready' ? account.user.name : ''
  const path = account.status === 'ready' ? account.user.avatarPath : null
  return (
    <Link
      to={paths.profile()}
      aria-label="Your profile"
      className="flex min-h-tap min-w-tap items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Avatar path={path} name={name} className="size-9 text-sm" />
    </Link>
  )
}
