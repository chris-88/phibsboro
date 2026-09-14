/// <reference lib="dom" />
import { expect, test } from './fixtures.ts'
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { PLAYER_STATE } from './auth.setup.ts'

// S3.4, D17: local preview against the seeded stack, never the live site. The seeded player (Aaron)
// belongs to Firsts and has a response on every Firsts event, so the member view — not the preview
// — renders on each. HashRouter, so every route lives after the `#`.

const FAR = eventFor(TEAM_FIRSTS.id, 'far') // scheduled, 10 days out — responses open
const PAST = eventFor(TEAM_FIRSTS.id, 'past') // scheduled, 7 days ago — window shut, started line
const CANCELLED = eventFor(TEAM_FIRSTS.id, 'cancelled') // cancelled — "This one's off."

test.use({ storageState: PLAYER_STATE })

const yes = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Yes' })
const no = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'No' })

test.describe('changing a response (S3.4)', () => {
  test('a player switches Yes to No and it survives a reload (AC1, AC2, AC3)', async ({ page }) => {
    await page.goto(`/#/event/${FAR.id}`)

    await expect(yes(page)).toBeVisible()
    // Land on the seeded Yes, then confirm No, and the switch sticks across a reload.
    await yes(page).click()
    await expect(yes(page)).toHaveAttribute('aria-pressed', 'true')

    await no(page).click()
    await expect(no(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(yes(page)).toHaveAttribute('aria-pressed', 'false')

    await page.reload()
    await expect(no(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(yes(page)).toHaveAttribute('aria-pressed', 'false')

    // Leave the seeded row as it was found, so a rerun starts from Yes again.
    await yes(page).click()
    await expect(yes(page)).toHaveAttribute('aria-pressed', 'true')
  })

  test('a started event disables both buttons with the started line (AC4)', async ({ page }) => {
    await page.goto(`/#/event/${PAST.id}`)
    await expect(yes(page)).toBeDisabled()
    await expect(no(page)).toBeDisabled()
    await expect(page.getByText(/^Too late now\. This started .+\.$/)).toBeVisible()
  })

  test('a cancelled event disables both buttons with "This one\'s off." (AC5)', async ({
    page,
  }) => {
    await page.goto(`/#/event/${CANCELLED.id}`)
    await expect(yes(page)).toBeDisabled()
    await expect(no(page)).toBeDisabled()
    await expect(page.getByText("This one's off.")).toBeVisible()
  })
})
