import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import App from '@/App'
import { registerServiceWorker } from '@/pwa/registerServiceWorker'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root is missing from index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// After render, never before: the first paint must not wait on a worker. The plugin emits
// no worker in `npm run dev`, so this registers nothing there (S0.4 AC10).
registerServiceWorker()
