import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { queryClient } from '@/api/queryClient'
import { AppBoot } from '@/app/app-boot'
import { router } from '@/app/router'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { SessionProvider } from '@/features/auth/session-provider'
import { InstallProvider } from '@/features/install/install-provider'

// The router instance lives in `@/app/router` so the S2.6 session teardown, which runs above the
// React tree in the auth subscription, can call `router.navigate()` (D59). HashRouter, never
// BrowserRouter: GitHub Pages serves static files, so every deep link fetches index.html and the
// app's route lives after the fragment (CLAUDE.md §2).

export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        {/* The one auth subscription (S2.9), above the router so every guard reads it and inside
            the query provider so the current-user query has its client. `AppBoot` (S2.6) shows the
            splash until the stored session resolves, so no route renders against an unknown
            session and a returning player never sees the login screen (AC7). */}
        <SessionProvider>
          {/* S2.7 / D45: registers the beforeinstallprompt listener at app start — inside the
              session provider, outside AppBoot — so the Android window is running while the splash
              is still up and the event, which fires early, is never missed. */}
          <InstallProvider>
            <AppBoot>
              <RouterProvider router={router} />
            </AppBoot>
          </InstallProvider>
        </SessionProvider>
      </AppErrorBoundary>
    </QueryClientProvider>
  )
}
