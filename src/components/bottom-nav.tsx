import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { isNavItemActive, navItemsForRole, type AppRole } from '@/lib/nav'

export interface BottomNavProps {
  role: AppRole
  /** A plain string, not a router hook, so the active state stays unit testable. S0.3's
   *  root layout supplies it from useLocation(). */
  currentPath: string
}

/**
 * Fixed bottom nav, one row of items for the viewer's role (D41). The bottom padding
 * carries env(safe-area-inset-bottom) so no item sits under an iPhone home indicator;
 * that inset is zero unless index.html sets viewport-fit=cover.
 */
export function BottomNav({ role, currentPath }: BottomNavProps): React.JSX.Element {
  const items = navItemsForRole(role)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-screen-sm">
        {items.map((item) => {
          const active = !item.disabled && isNavItemActive(item.to, currentPath)
          const Icon = item.icon
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-3 top-0 h-0.5 rounded-full',
                  active ? 'bg-foreground' : 'bg-transparent',
                )}
              />
              <Icon className="size-5" aria-hidden="true" />
              {item.label}
            </>
          )
          const cls = cn(
            'relative flex min-h-tap flex-col items-center justify-center gap-0.5 px-2 py-1 text-xs',
            // Active is marked three ways — a bar, weight and colour — so it survives a greyscale
            // screenshot (AC10).
            active ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
          )
          return (
            <li key={item.to} className="flex-1">
              {item.disabled ? (
                // A signpost, not a destination (W8): greyed, un-tappable, and announced disabled.
                <span aria-disabled="true" className={cn(cls, 'opacity-40')}>
                  {content}
                </span>
              ) : (
                // A router Link, not a bare `<a href="#/…">`: a native fragment jump arrives as a
                // popstate with no history key, so ScrollRestoration restores the old page's scroll
                // onto the new one instead of starting at the top (S0.3 AC14).
                <Link to={item.to} aria-current={active ? 'page' : undefined} className={cls}>
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
