/**
 * The single source of truth for the route rows in `docs/state-coverage.md` (S7.1 AC1). Both
 * `states.test.tsx` and `state-coverage-doc.test.ts` read it: the first mounts each route, the
 * second fails if the document's route column drifts from this list, so the audit artifact stays
 * honest without anyone remembering to update it.
 *
 * The `code` is exactly the cell text in the document's first column. The two conditional surfaces
 * (S2.7 escape prompt, S2.8 install guide) are not routes and are not listed here; the document
 * carries them in a separate section and the doc test only checks these route rows.
 */
export const ROUTES = [
  { code: '/', name: 'home' },
  { code: '/login', name: 'login' },
  { code: '/register', name: 'register' },
  { code: '/join/:token', name: 'join' },
  { code: '/reset/:token', name: 'reset' },
  { code: '/event/:id', name: 'event' },
  { code: '/history', name: 'history' },
  { code: '/manage', name: 'manage' },
  { code: '/manage/event/new', name: 'new event' },
  { code: '/manage/event/:id', name: 'manage event' },
  { code: '/manage/team/:teamId/members', name: 'members' },
  { code: '/admin', name: 'admin' },
  { code: '404', name: '404' },
] as const

export type RouteManifestEntry = (typeof ROUTES)[number]
