import { cn } from 'cn'
import { locationDisplay } from '@/lib/home-venue'

export interface LocationTextProps {
  location: string
  className?: string
}

/**
 * A stored `location` rendered through the one `locationDisplay` helper (S8.4): a URL becomes a
 * tappable link that opens the maps app / a new tab, `rel="noopener noreferrer"`, tall enough to
 * tap (min-h-tap); any other value is plain text. Used by every screen that shows a location, so
 * none of them render `location` ad-hoc.
 */
export function LocationText({ location, className }: LocationTextProps): React.JSX.Element {
  const { href, label } = locationDisplay(location)
  if (href !== undefined) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex min-h-tap items-center gap-1 font-medium text-primary underline underline-offset-2',
          className,
        )}
      >
        {label}
      </a>
    )
  }
  return <span className={className}>{label}</span>
}
