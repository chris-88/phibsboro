/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { MANAGER_STATE, PLAYER_STATE } from './auth.setup.ts'

// S2.9 guard journeys against the seeded database (D17: local preview, never the live site).
// HashRouter, so every route lives after the `#`.

const IMMINENT_EVENT = eventFor(TEAM_FIRSTS.id, 'imminent').id

test.describe('a signed-in player', () => {
  test.use({ storageState: PLAYER_STATE })

  test('is redirected off /#/manage back to home (AC4)', async ({ page }) => {
    await page.goto('/#/manage')
    await expect(page).toHaveURL(/#\/$/)
    // The manager screen never renders; the home nav item is current instead.
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  })
})

test.describe('a signed-in manager', () => {
  test.use({ storageState: MANAGER_STATE })

  test('reaches /#/manage', async ({ page }) => {
    await page.goto('/#/manage')
    await expect(page).toHaveURL(/#\/manage$/)
  })

  test('is redirected off /#/admin back to home (AC5)', async ({ page }) => {
    await page.goto('/#/admin')
    await expect(page).toHaveURL(/#\/$/)
  })

  test('does not flash the login screen on reload (AC8)', async ({ page }) => {
    await page.goto('/#/')
    await page.reload()
    // The login heading must never appear for a user with a valid stored session.
    await expect(page.getByRole('heading', { name: /sign in/i })).toHaveCount(0)
    await expect(page).toHaveURL(/#\/$/)
  })
})

test.describe('an unauthenticated visitor', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('is sent to /#/login with the intended route recorded (AC6)', async ({ page }) => {
    await page.goto('/#/history')
    await expect(page).toHaveURL(/#\/login$/)
    const stored = await page.evaluate(() => localStorage.getItem('pfc.intendedRoute'))
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored ?? '{}') as { path?: string }
    expect(parsed.path).toBe('/history')
  })

  test('is not bounced off a public event deep link (AC7)', async ({ page }) => {
    await page.goto(`/#/event/${IMMINENT_EVENT}`)
    await expect(page).not.toHaveURL(/#\/login$/)
    await expect(page).toHaveURL(new RegExp(`#/event/${IMMINENT_EVENT}$`))
  })
})
