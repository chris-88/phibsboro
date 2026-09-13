import { RouterProvider, createHashRouter } from 'react-router'
import { routes } from '@/routes'

// HashRouter, never BrowserRouter: GitHub Pages serves static files, and everything after
// the fragment never leaves the browser, so every deep link fetches index.html (CLAUDE.md §2).
const router = createHashRouter(routes)

export default function App(): React.JSX.Element {
  return <RouterProvider router={router} />
}
