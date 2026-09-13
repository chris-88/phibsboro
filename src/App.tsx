import { RouterProvider, createHashRouter } from 'react-router'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import { routes } from '@/routes'

// HashRouter, never BrowserRouter: GitHub Pages serves static files, and everything after
// the fragment never leaves the browser, so every deep link fetches index.html (CLAUDE.md §2).
const router = createHashRouter(routes)

// The boundary sits outside the router so it catches what the route `errorElement` cannot —
// the router itself, the layout, a provider — and stays inside whatever providers later
// stories add around it so the fallback gets their context. A screen that throws is caught
// by the route element, which reports to Sentry itself (S0.6).
export default function App(): React.JSX.Element {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  )
}
