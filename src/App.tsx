import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createHashRouter } from 'react-router'
import { queryClient } from '@/api/queryClient'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { routes } from '@/routes'

// HashRouter, never BrowserRouter: GitHub Pages serves static files, and everything after
// the fragment never leaves the browser, so every deep link fetches index.html (CLAUDE.md §2).
const router = createHashRouter(routes)

// The boundary sits outside the router so it catches what the route `errorElement` cannot —
// the router itself, the layout, a provider — and inside the query provider so the fallback
// gets its context. A screen that throws is caught by the route element, which reports to
// Sentry itself (S0.6). No screen reads data yet; S3.x and S4.x do, through hooks in src/api/.
export default function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
        <RouterProvider router={router} />
      </AppErrorBoundary>
    </QueryClientProvider>
  )
}
