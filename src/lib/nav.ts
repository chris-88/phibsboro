import { ClipboardList, History, House, Shield, type LucideIcon } from 'lucide-react'

export type AppRole = 'player' | 'manager' | 'admin'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
}

/**
 * What the bottom nav shows for a role. This is presentation convenience and nothing
 * more: RLS is the enforcement layer, and a player who types /manage into the address
 * bar sees no data regardless of what this function returns.
 *
 * `to` values are the D34 route paths as plain strings. S0.3 replaces them with its
 * `paths` helpers when that story lands.
 */
export function navItemsForRole(role: AppRole): NavItem[] {
  const items: NavItem[] = [
    { label: 'Home', to: '/', icon: House },
    { label: 'History', to: '/history', icon: History },
  ]
  if (role === 'manager' || role === 'admin') {
    items.push({ label: 'Manage', to: '/manage', icon: ClipboardList })
  }
  if (role === 'admin') {
    items.push({ label: 'Admin', to: '/admin', icon: Shield })
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
