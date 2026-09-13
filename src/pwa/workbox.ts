import type { VitePWAOptions } from 'vite-plugin-pwa'

/**
 * D43. Exactly one runtime route, for navigations only: network first, three seconds, then
 * the last shell this worker fetched, then the shell it was built with. Hashed assets are
 * precached and immutable. Anything else — every Supabase REST and RPC call — matches no
 * route and goes straight to the network, uncached, without being named here.
 */
export const workboxOptions = {
  // No webmanifest in the glob: the plugin precaches the manifest itself, and a second entry
  // for the same URL is a duplicate at best.
  globPatterns: ['**/*.{js,css,html,svg,png}'],
  // Two defaults each serve navigations straight from the precache — cache first — which is
  // exactly the stale shell the brief forbids, and both must be off. navigateFallback is
  // the NavigationRoute; directoryIndex is the PrecacheRoute mapping `/` onto the precached
  // index.html, and it is registered ahead of every runtime route. Proved by the AC5 test:
  // with directoryIndex left alone, reload one came from cache-storage with build A.
  navigateFallback: null,
  directoryIndex: null,
  // Left to its default, the plugin mirrors build.sourcemap and writes sw.js.map after the
  // Sentry plugin has already deleted the app maps, so a map would reach Pages (S0.6 AC4).
  // Nobody needs a trace from the worker; the app maps are what Sentry gets.
  sourcemap: false,
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pfc-shell',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 1 },
        cacheableResponse: { statuses: [200] },
        // The first navigation is never intercepted (the worker that handles it has not
        // been installed yet), so pfc-shell is empty on a first-visit-then-offline reload.
        // The precached index.html of this same build is the shell of last resort.
        precacheFallback: { fallbackURL: 'index.html' },
      },
    },
  ],
} as const satisfies NonNullable<VitePWAOptions['workbox']>
