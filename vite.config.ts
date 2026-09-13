import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { manifestFor } from './src/pwa/manifest.ts'
import { workboxOptions } from './src/pwa/workbox.ts'

// The custom domain app.phibsboro.ie serves from the root, so base is '/'. Until its DNS is
// pointed at Pages we publish to the project page instead, which serves from /phibsboro/ — hence
// VITE_BASE_PATH rather than a hardcoded value (S0.5 deviation). build.sourcemap is set by S0.6 per D16.
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    // D43. The manifest and Workbox options live in src/pwa/ so their unit tests can import
    // the very objects the build uses (S0.4 AC1, AC7).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // registered explicitly in src/main.tsx
      manifest: manifestFor(base),
      workbox: workboxOptions,
      devOptions: { enabled: false }, // a dev reload never serves a cached bundle (AC10)
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // 404.html is a second HTML entry so %BASE_URL% is substituted; see the comment in it.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        404: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
    },
  },
})
