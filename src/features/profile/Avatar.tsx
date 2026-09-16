import { useState } from 'react'
import { avatarUrl, initialsOf } from '@/features/profile/avatar-url'
import { cn } from 'cn'

export interface AvatarProps {
  /** Storage object path, or null → initials fallback (W10). */
  path: string | null
  /** Drives the initials fallback and the alt text. */
  name: string
  /** Sizing/typography utilities from the caller, e.g. `size-8 text-sm` or `size-24 text-2xl`. */
  className?: string
}

/**
 * A user's photo or a coloured initials circle (W9/W10). The image is `object-cover` in a circle;
 * a broken URL falls back to initials rather than a broken-image icon. Decorative by default
 * (`aria-hidden` — the surrounding control names itself), so it never double-announces the name.
 */
export function Avatar({ path, name, className }: AvatarProps): React.JSX.Element {
  const url = avatarUrl(path)
  const [failed, setFailed] = useState(false)
  const showImage = url !== null && !failed
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground select-none',
        className,
      )}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          onError={() => {
            setFailed(true)
          }}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  )
}
