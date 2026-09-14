/// <reference lib="dom" />
import { expect, test } from './fixtures.ts'
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { PLAYER_STATE } from './auth.setup.ts'

// S2.7, D46: the WhatsApp-webview leg of the journey. The seeded player (Aaron, on Firsts) opens an
// event deep link inside a simulated iOS WhatsApp webview, answers, and only then meets the escape
// prompt. No CI browser is a real webview, so the iOS WhatsApp user agent on Chromium is the closest
// automatable proxy; the classification is synchronous for an iOS UA, so the engine does not matter.
// D17: local preview against the seeded stack, never the live site.

const WHATSAPP_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.23.20.79'

const FAR = eventFor(TEAM_FIRSTS.id, 'far') // scheduled, 10 days out — responses open
const IMMINENT = eventFor(TEAM_FIRSTS.id, 'imminent') // scheduled, 26h out — responses open

test.use({
  storageState: PLAYER_STATE,
  userAgent: WHATSAPP_IOS_UA,
  isMobile: true,
  hasTouch: true,
  viewport: { width: 390, height: 844 },
  permissions: ['clipboard-read', 'clipboard-write'],
})

const yes = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Yes' })
const no = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'No' })
const escapeLine = /open in safari to add this to your home screen/i

test.describe('escape the WhatsApp browser (S2.7)', () => {
  test('respond first, then the escape prompt, with the buttons still live (AC4, AC5, AC7)', async ({
    page,
  }) => {
    await page.goto(`/#/event/${FAR.id}`)
    await expect(yes(page)).toBeVisible()

    // Nothing before a response (AC4). The seeded answer is Yes, so switch to No to force a write.
    await expect(page.getByText(escapeLine)).toHaveCount(0)
    await no(page).click()
    await expect(no(page)).toHaveAttribute('aria-pressed', 'true')

    // Now the prompt is on screen, and only this prompt (AC11).
    await expect(page.getByText(escapeLine)).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(1)

    // The YES / NO buttons stay visible and interactive with the prompt up (AC5).
    await expect(yes(page)).toBeEnabled()
    await expect(no(page)).toBeEnabled()

    // Copy link puts the app root on the clipboard, never the event URL (AC7, D47).
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/\/#\/$/)
    expect(copied).not.toContain(FAR.id)

    // Dismissing removes it, and a later response on another event does not bring it back (AC9).
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect(page.getByText(escapeLine)).toHaveCount(0)

    await page.goto(`/#/event/${IMMINENT.id}`)
    await expect(yes(page)).toBeVisible()
    await no(page).click()
    await expect(no(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(escapeLine)).toHaveCount(0)

    // Leave both seeded rows as they were found, so a rerun starts from Yes again.
    await yes(page).click()
    await expect(yes(page)).toHaveAttribute('aria-pressed', 'true')
    await page.goto(`/#/event/${FAR.id}`)
    await yes(page).click()
    await expect(yes(page)).toHaveAttribute('aria-pressed', 'true')
  })
})
