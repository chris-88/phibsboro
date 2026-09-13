import { ChevronLeft } from 'lucide-react'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Toaster } from '@/components/ui/sonner'
import { VersionTag } from '@/components/version-tag'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/lib/nav'

/** `nav` is a normal page. `bare` is a deep-link target — no nav, so the large YES / NO
 *  buttons are never underneath it (D41). S0.3 owns the route-to-chrome mapping. */
export type Chrome = 'nav' | 'bare'

export interface AppShellProps {
  chrome: Chrome
  role: AppRole
  title?: string
  /** `bare` only. Defaults to going back in history, which is right for a link tapped
   *  from WhatsApp. */
  onBack?: () => void
  /** `nav` only, for marking the active item. S0.3 supplies it from useLocation(). */
  currentPath?: string
  children: React.ReactNode
}

export function AppShell({
  chrome,
  role,
  title,
  onBack,
  currentPath = '/',
  children,
}: AppShellProps): React.JSX.Element {
  const goBack =
    onBack ??
    (() => {
      window.history.back()
    })

  return (
    // min-h-dvh, not min-h-screen: 100vh is wrong in mobile Safari while the URL bar is
    // showing, and the difference is about the height of a YES button.
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* pt carries the top inset so a title never sits under an iPhone status bar;
          index.html's viewport-fit=cover is what makes the inset non-zero (AC12). */}
      <header className="flex items-center gap-1 px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        {chrome === 'bare' && (
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Back">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Button>
        )}
        {title !== undefined && (
          <h1 className={cn('truncate text-base font-semibold', chrome === 'nav' && 'px-1')}>
            {title}
          </h1>
        )}
      </header>

      <main className="flex-1 px-4 pb-6">{children}</main>

      {/* In flow below the content, so it overlaps nothing (S0.4 AC15). Its bottom padding
          clears the fixed nav, the home indicator below it, and a line of breathing room,
          so the last row of a long page and any bottom action stay readable (S0.2 AC6). */}
      <footer
        className={cn(
          'px-4 pt-2',
          chrome === 'nav'
            ? 'pb-[calc(var(--spacing-tap)+env(safe-area-inset-bottom)+1rem)]'
            : 'pb-[calc(env(safe-area-inset-bottom)+1rem)]',
        )}
      >
        <VersionTag />
      </footer>

      {/* Inside the shell and above the nav in z-order, or a toast renders behind it. */}
      <Toaster position="top-center" className="z-50" />

      {chrome === 'nav' && <BottomNav role={role} currentPath={currentPath} />}
    </div>
  )
}

/**
 * Chrome only: the header bar and nav shapes as skeletons, no content slot. S2.9 renders
 * this while the session resolves, so there is no flash of the login screen and no
 * full-screen spinner.
 */
export function AppShellSkeleton(): React.JSX.Element {
  return (
    <div
      className="flex min-h-dvh flex-col bg-background"
      aria-busy="true"
      aria-label="Loading"
      role="status"
    >
      <header className="flex items-center px-3 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
        <Skeleton className="h-5 w-32" />
      </header>
      <main className="flex-1 px-4 pb-[calc(var(--spacing-tap)+env(safe-area-inset-bottom)+1rem)]" />
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-screen-sm">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex min-h-tap flex-1 flex-col items-center justify-center gap-1"
            >
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="h-2 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
