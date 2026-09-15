import { useSession } from '@/features/auth/session-context'

/** The club eagle for the splash: black on white, so it sits seamlessly on the light splash
 *  background (the app icon is the inverse, white-on-black). A *relative* URL, so it resolves
 *  against the document's own base — right at `/` on the custom domain and at `/phibsboro/` on the
 *  Pages project page — without reading `import.meta.env` (the env boundary is `@/lib/env`, S1.5
 *  AC6). The HashRouter fragment never changes the document base, so this is stable on every deep
 *  link. index.html renders the same image, so the handover is seamless (AC9). */
const CREST_SRC = 'icons/splash.png'

/**
 * The React splash. Byte-identical in look to the static shell in `index.html` (AC9): the crest
 * centred on the theme background, nothing else — no spinner, no "Loading…", no login controls.
 * React's first paint replaces the static shell with this, so the handover produces no visible
 * change. The colour is `bg-background`, the same token the shell's inline style reads, so there is
 * one source of truth for it (CLAUDE.md §3).
 */
export function AppSplash(): React.JSX.Element {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <img
        src={CREST_SRC}
        alt="Phibsboro FC"
        width={88}
        height={88}
        className="size-22 rounded-full"
        // The crest is already in the shell; decoding sync avoids a flicker on the handover.
        decoding="sync"
      />
    </div>
  )
}

/**
 * The boot gate (S2.6). Renders the splash while the one auth subscription is still resolving the
 * stored session, and the app only once `status` has settled to `signedIn` or `signedOut`. Nothing
 * below it — no route, guarded or not — resolves against an unknown session, which is what keeps a
 * returning player off the login screen (AC7) and preserves S2.5's deep-link destination.
 *
 * There is no error branch: `getSession()` rejecting resolves to `signedOut` in the provider, and
 * the router then renders `/login` with its own offline line. The gate only ever waits or passes.
 */
export function AppBoot({ children }: { children: React.ReactNode }): React.JSX.Element {
  const session = useSession()
  if (session.status === 'loading') return <AppSplash />
  return <>{children}</>
}
