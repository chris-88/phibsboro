/// <reference lib="dom" />
import { expect, test } from './fixtures.ts'
import { TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { MANAGER_STATE } from './auth.setup.ts'

// S4.6, D17: local preview against the seeded stack, never the live site. Declan Ward (MANAGERS[0])
// manages Firsts. The manager turns on Repeat weekly, picks a Tuesday evening 12 weeks out, confirms
// the dialog names 12, and lands on the list with 12 sessions all at the same Dublin time; then
// cancels the third through S4.2 and the other 11 stay scheduled. HashRouter, so paths carry `#`.
//
// NOTE: this project runs only when RUN_LOCAL_STACK enables the seeded preview (see CI). It is
// wired here; its live run is deferred with the rest of the e2e job.

const TITLE = 'E2E S4.6 Training'

// A Tuesday at least ~40 days out, computed in UTC so the weekday is stable regardless of the node
// process timezone; the browser context is pinned to Europe/Dublin for what the page renders.
function futureTuesday(): string {
  const d = new Date(Date.now() + 40 * 86_400_000)
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

test.use({ storageState: MANAGER_STATE, viewport: { width: 375, height: 667 } })

test.describe('recurring training (S4.6)', () => {
  test('generates twelve weekly sessions, then cancels one and leaves the rest', async ({
    page,
  }) => {
    const date = futureTuesday()
    await page.goto(`/#/manage/event/new?team=${TEAM_FIRSTS.id}`)

    // Type defaults to training, so the switch is offered (AC1).
    await page.getByLabel('Title').fill(TITLE)
    await page.getByLabel('Date').fill(date)
    await page.getByLabel('Start time').fill('19:30')
    await page.getByLabel('Location').fill('Dalymount Park')

    await page.getByRole('switch', { name: 'Repeat weekly' }).click()

    // The horizon defaults to 12; choose it explicitly to prove the control (AC3).
    await page.getByRole('combobox', { name: 'How many weeks?' }).click()
    await page.getByRole('option', { name: '12 weeks' }).click()

    await page.getByRole('button', { name: 'Create sessions' }).click()

    // AC8: the confirm names the count and the span before anything is written.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('This creates 12 training sessions.')
    await expect(dialog).toContainText('First:')
    await expect(dialog).toContainText('Last:')
    await dialog.getByRole('button', { name: 'Create sessions' }).click()

    // AC9: back on the team list with the result line and the new rows present.
    await expect(page.getByText('12 sessions created.')).toBeVisible()
    const rows = page.getByRole('listitem').filter({ hasText: TITLE })
    await expect(rows).toHaveCount(12)

    // AC4/AC6: every session shows the same Dublin time.
    await expect(rows.getByText('7.30pm')).toHaveCount(12)

    // AC10: cancel the third occurrence and assert only it changes.
    await rows
      .nth(2)
      .getByRole('button', { name: /Actions for/ })
      .click()
    await page.getByRole('menuitem', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Cancel event' }).click()

    await expect(rows.filter({ hasText: 'Cancelled' })).toHaveCount(1)
    await expect(rows.nth(2)).toContainText('Cancelled')
  })
})
