import { BarChart3, CalendarDays, House, Shield, Users, type LucideIcon } from 'lucide-react'
import { paths } from '@/lib/paths'

export type AppRole = 'player' | 'manager' | 'admin'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** A signpost tab that is shown but not selectable — greyed, no navigation (W8, the Stats
   *  placeholder). Its `to` is never navigated to. */
  disabled?: boolean
}

/**
 * What the bottom nav shows for a role. This is presentation convenience and nothing
 * more: RLS is the enforcement layer, and a player who types /manage into the address
 * bar sees no data regardless of what this function returns.
 */
export function navItemsForRole(role: AppRole): NavItem[] {
  const items: NavItem[] = [
    { label: 'Home', to: paths.home(), icon: House },
    // Stats is a disabled placeholder where History used to be (W8): a richer stats surface is a
    // later epic. The calendar Home covers reverse-chronology in the meantime.
    { label: 'Stats', to: '/stats', icon: BarChart3, disabled: true },
  ]
  if (role === 'manager' || role === 'admin') {
    items.push({ label: 'Schedule', to: paths.manage(), icon: CalendarDays })
  }
  // The Squad hub is a manager tab only (Q4): admins keep the fourth slot for Admin and reach a
  // team's members through Admin and matchday through the match view. No fifth tab either way.
  if (role === 'manager') {
    items.push({ label: 'Squad', to: paths.squad(), icon: Users })
  }
  if (role === 'admin') {
    items.push({ label: 'Admin', to: paths.admin(), icon: Shield })
  }
  return items
}

/**
 * True when `currentPath` is inside `item.to`. Deeper routes light their section up, so
 * /manage/event/new marks Manage active. Home is exact-match only, or it would match
 * everything.
 */
export function isNavItemActive(to: string, currentPath: string): boolean {
  if (to === '/') return currentPath === '/'
  return currentPath === to || currentPath.startsWith(`${to}/`)
}
