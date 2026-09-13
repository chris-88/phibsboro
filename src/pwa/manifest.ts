// The two hex literals below must equal --pwa-theme-color and --pwa-background-color in
// src/index.css. manifest.test.ts parses that file and fails if they drift. This file is the
// only hex-literal exemption under src/ (scripts/check-conventions.mjs).
const THEME_COLOR = '#1351a6'
const BACKGROUND_COLOR = '#ffffff'

/** Relative to the Vite base, never absolute: the same build must be right at `/` on the
 *  custom domain and at `/phibsboro/` on the Pages project page (S0.5 deviation). */
export const ICON_FILES = [
  { file: 'icons/icon-192.png', size: 192, purpose: 'any' },
  { file: 'icons/icon-512.png', size: 512, purpose: 'any' },
  { file: 'icons/icon-512-maskable.png', size: 512, purpose: 'maskable' },
] as const

export const APPLE_TOUCH_ICON = { file: 'apple-touch-icon.png', size: 180 } as const

/**
 * The web app manifest for a given Vite base. `id`, `start_url` and `scope` are all the
 * base, so a player who installs from an event link opens on home, and every hash route
 * stays in scope. vite-plugin-pwa does not resolve these against `base` for us — a
 * literal '/' would point the installed app at the origin root, which on the project page
 * is somebody else's site and outside the service worker's scope.
 */
export function manifestFor(base: string) {
  if (!base.startsWith('/') || !base.endsWith('/')) {
    throw new Error(`Vite base must start and end with '/', got '${base}'`)
  }
  return {
    id: base,
    name: 'Phibsboro FC',
    short_name: 'Phibsboro',
    description: 'Training and match availability for Phibsboro FC.',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait',
    lang: 'en-IE',
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    icons: ICON_FILES.map(({ file, size, purpose }) => ({
      src: `${base}${file}`,
      sizes: `${String(size)}x${String(size)}`,
      type: 'image/png',
      purpose,
    })),
  } as const
}

export type Manifest = ReturnType<typeof manifestFor>
