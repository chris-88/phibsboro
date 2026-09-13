/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { PLAYER_STATE } from './auth.setup.ts'

// S2.6, D17: local preview, never the live site. The one that matters is AC7 — a cold start with a
// valid stored session must never put the sign-in heading in the DOM, because a flash means the
// router already navigated and S2.5's deep-link destination is lost. Asserted by a listener that
// fails the test the instant the heading appears, not by a screenshot.

test.describe('a returning player with a stored session', () => {
  test.use({ storageState: PLAYER_STATE })

  test('never flashes the sign-in screen on cold start (AC7)', async ({ page }) => {
    // Fail loudly if the login heading is ever painted, at any point during the boot.
    let sawLogin = false
    await page.exposeFunction('__flagLogin', () => {
      sawLogin = true
    })
    await page.addInitScript(() => {
      const w = window as unknown as { __flagLogin: () => void }
      const check = (): void => {
        const found = Array.from(document.querySelectorAll('h1')).some((el) =>
          /sign in/i.test(el.textContent),
        )
        if (found) w.__flagLogin()
      }
      document.addEventListener('DOMContentLoaded', () => {
        check()
        new MutationObserver(check).observe(document.body, { childList: true, subtree: true })
      })
    })

    await page.goto('/#/')
    // The app has settled off the splash and onto a real route.
    await expect(page).toHaveURL(/#\/$/)
    await page.waitForLoadState('networkidle')
    expect(sawLogin).toBe(false)
  })

  test('restores the session across a reload without a login flash (AC7, AC13)', async ({
    page,
  }) => {
    await page.goto('/#/')
    await page.reload()
    await expect(page.getByRole('heading', { name: /sign in/i })).toHaveCount(0)
    await expect(page).toHaveURL(/#\/$/)
  })
})

test.describe('a signed-out visitor', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('does land on the sign-in screen for a guarded route (control)', async ({ page }) => {
    await page.goto('/#/history')
    await expect(page).toHaveURL(/#\/login$/)
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible()
  })
})
