import type { Chrome } from '@/components/app-shell'

/** Declared per route in `src/routes.tsx`, enforced by S2.9's guards. UI convenience only;
 *  RLS is the boundary. */
export type GuardLevel = 'public' | 'authed' | 'manager' | 'admin'

export interface AppRouteMeta {
  path: string
  chrome: Chrome
  guard: GuardLevel
  title: string
}

/** React Router types a route `handle` as `unknown`; this is how the layout reads it back. */
export function isAppRouteMeta(handle: unknown): handle is AppRouteMeta {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'chrome' in handle &&
    'guard' in handle &&
    'title' in handle &&
    'path' in handle
  )
}
