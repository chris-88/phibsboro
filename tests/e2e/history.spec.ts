/// <reference lib="dom" />
import { expect, test } from './fixtures.ts'
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { PLAYER_STATE } from './auth.setup.ts'

// S3.5, D17: local preview against the seeded stack, never the live site. HashRouter, so every
// route lives after the `#`.
//
// The seeded player (Aaron) holds an `attended` attendance row on the Firsts past training, and
// every member joined after that event, so `filterHistory` keeps exactly the rows carrying a
// recorded result. His History is therefore one row — the past training, marked Attended.
//
// The full three-state spread (an Absent, a Not recorded and a Cancelled past row for one player)
// and the empty-history player both need the S1.2 seed extension raised in this story's Open
// question 1; those assertions live in the unit and component suites until the seed carries them.

const PAST = eventFor(TEAM_FIRSTS.id, 'past')

test.use({ storageState: PLAYER_STATE })

test.describe('own attendance history (S3.5)', () => {
  test('History from the nav lists the past event, marked, read-only (AC1, AC2, AC3, AC5)', async ({
    page,
  }) => {
    await page.goto('/#/')
    await page.getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/#\/history$/)

    const row = page.getByRole('link', { name: new RegExp(PAST.title) }).first()
    await expect(row).toBeVisible()
    // The recorded result Aaron can check without asking his manager.
    await expect(row).toContainText('Attended')
    // Read-only: no control that writes lives inside a row (AC5).
    await expect(row.getByRole('button')).toHaveCount(0)
    await expect(row.getByRole('checkbox')).toHaveCount(0)
    await expect(row.getByRole('textbox')).toHaveCount(0)
  })

  test('tapping a row lands on the event with the past controls disabled (AC11)', async ({
    page,
  }) => {
    await page.goto('/#/history')
    await page
      .getByRole('link', { name: new RegExp(PAST.title) })
      .first()
      .click()
    await expect(page).toHaveURL(new RegExp(`#/event/${PAST.id}$`))
    // S3.4 AC4: a started event disables both availability buttons.
    await expect(page.getByRole('button', { name: 'Yes' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'No' })).toBeDisabled()
  })
})
