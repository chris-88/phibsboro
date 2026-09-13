import { describe, expect, it } from 'vitest'
import { isRestorableRoute, RESTORABLE_PATTERNS } from '@/lib/intended-route'
import { routeTable } from '@/routes'

// The allowlist in intended-route.ts is a hand-kept copy of the router's destination paths, not a
// runtime import of the route table (that would form a cycle: routes -> guards -> intended-route).
// This test is what stops the copy from drifting: add or remove a route and it fails until the
// allowlist is updated to match (S2.5, D34).

/** The router paths that are real destinations: everything but the auth waypoints and the 404. */
const WAYPOINTS = ['/login', '/register', '/join/:token', '/reset/:token']
const destinations = routeTable
  .map((r) => r.path)
  .filter((p) => p !== '*' && !WAYPOINTS.includes(p))

/** A concrete pathname from a pattern, so matchRoutes has something to resolve: `:seg` -> `x`. */
const concretise = (pattern: string): string => pattern.replace(/:[^/]+/g, 'x')

describe('the restorable allowlist matches the router (no drift)', () => {
  it('lists exactly the router destinations, and nothing else', () => {
    expect([...RESTORABLE_PATTERNS].sort()).toEqual([...destinations].sort())
  })

  it('accepts every router destination', () => {
    for (const pattern of destinations) {
      expect(isRestorableRoute(concretise(pattern))).toBe(true)
    }
  })

  it('rejects every auth waypoint', () => {
    for (const pattern of WAYPOINTS) {
      expect(isRestorableRoute(concretise(pattern))).toBe(false)
    }
  })
})
