import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { initSentry } from '@/lib/sentry'
import { registerServiceWorker } from '@/pwa/registerServiceWorker'

// Before anything else runs, so a failure in the render below is itself reported (S0.6 AC1).
initSentry()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root is missing from index.html')

// The app graph is imported here, not at the top: ESM evaluates every static import before a
// line of this file runs, and src/lib/env.ts throws at load on a malformed environment. Loading
// it after initSentry() means that throw is reported rather than a silent blank page (S1.5 AC6).
// A rejection here is left unhandled on purpose: Sentry's global handler captures it.
void import('@/App').then(({ default: App }) => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )

  // After render, never before: the first paint must not wait on a worker. The plugin emits
  // no worker in `npm run dev`, so this registers nothing there (S0.4 AC10).
  registerServiceWorker()
})
