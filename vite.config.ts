import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base is '/' because the site is served from the apex of app.phibsborofc.com (S0.5),
// not from a /{repo}/ path. build.sourcemap is set by S0.6 per D16 — leave it alone here.
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
