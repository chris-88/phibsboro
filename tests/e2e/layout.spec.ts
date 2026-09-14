/// <reference lib="dom" />
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { MANAGER_STATE } from './auth.setup.ts'
import { expect, test } from './fixtures.ts'

/**
 * S7.1 AC9. A 375×667 layout sweep over every route: no horizontal scroll on the document, and no
 * visible interactive element under 44px on its smaller axis (D40's floor, held after twenty
 * stories of building). Signs in once as the seeded manager (D17: local preview, never the live
 * site) so the manage routes render populated; the public routes redirect or render their own
 * screen, and the sweep measures whatever the viewport actually shows.
 *
 * Deferred run: the local-stack Playwright jobs are gated behind RUN_LOCAL_STACK and currently skip
 * (a CLI local-stack 403), so this spec is written and wired but its live pass is deferred to when
 * that gate is enabled. The four-state and 44px unit checks in `src/test` verify the rest here.
 */

const FAR = eventFor(TEAM_FIRSTS.id, 'far')

// Interactive elements that must clear the 44px floor. Matches the AC9 selector.
const INTERACTIVE = 'button, a[href], input, select, [role="button"], [role="switch"]'
const FLOOR = 44
// Sub-pixel rounding: a 44px target can measure 43.99. One physical pixel of slack, no more.
const TOLERANCE = 1

const ROUTES = [
  '/',
  '/login',
  '/register',
  '/join/not-a-real-token',
  '/reset/not-a-real-token',
  `/event/${FAR.id}`,
  '/history',
  '/manage',
  '/manage/event/new',
  `/manage/event/${FAR.id}`,
  `/manage/team/${TEAM_FIRSTS.id}/members`,
  '/admin',
  '/no-such-route',
]

test.use({ storageState: MANAGER_STATE, viewport: { width: 375, height: 667 } })

for (const route of ROUTES) {
  test(`no horizontal scroll and 44px targets at 375px — ${route}`, async ({ page }) => {
    // HashRouter: every route lives after the '#'.
    await page.goto(`/#${route}`)
    await page.waitForLoadState('networkidle')

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )
    expect(overflows, `${route} scrolls horizontally at 375px`).toBe(false)

    const targets = page.locator(INTERACTIVE)
    const count = await targets.count()
    for (let i = 0; i < count; i++) {
      const el = targets.nth(i)
      if (!(await el.isVisible())) continue
      const box = await el.boundingBox()
      // Zero-area or off-screen (a closed dialog, a hidden field) is skipped, not failed.
      if (!box || box.width === 0 || box.height === 0) continue
      const smaller = Math.min(box.width, box.height)
      expect(
        smaller,
        `${route}: an interactive element is ${String(Math.round(smaller))}px on its smaller axis`,
      ).toBeGreaterThanOrEqual(FLOOR - TOLERANCE)
    }
  })
}
