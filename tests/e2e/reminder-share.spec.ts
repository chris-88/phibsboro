/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { MANAGER_STATE } from './auth.setup.ts'

// S5.3, D17: local preview against the seeded stack, never the live site. Declan Ward (MANAGERS[0])
// manages Firsts; its "far" event is scheduled and ten days out, so both the primary share and the
// reminder render (AC6). Firsts' far event has some responses and some outstanding, so Awaiting > 0.
const FAR = eventFor(TEAM_FIRSTS.id, 'far')

function bodyFromAnchor(href: string): string {
  const prefix = 'https://wa.me/?text='
  expect(href.startsWith(prefix)).toBe(true)
  return decodeURIComponent(href.slice(prefix.length))
}

test.use({ storageState: MANAGER_STATE, viewport: { width: 375, height: 667 } })

test.describe('the reminder share (S5.3)', () => {
  test('carries the exact Awaiting figure shown on screen (AC4, AC7, AC8)', async ({ page }) => {
    await page.addInitScript(() => {
      // Remove the native sheet so the tap is a plain navigation and the href is the source of
      // truth (AC8 wa.me fallback). The reminder body is read straight off the anchor.
      // @ts-expect-error deleting an optional DOM member
      delete navigator.share
    })

    await page.goto(`/#/manage/event/${FAR.id}`)

    // The number in the message must equal the number in the "Awaiting" tile at the moment of the
    // tap (AC4). Read the tile, not a fixture constant, so the two are compared to each other.
    const awaitingTile = page
      .getByRole('group', { name: 'Response counts' })
      .locator('div')
      .filter({ hasText: /^\d+Awaiting$/ })
    await expect(awaitingTile).toBeVisible()
    const awaiting = Number((await awaitingTile.innerText()).replace(/\D/g, ''))
    expect(awaiting).toBeGreaterThan(0)

    const reminder = page.getByRole('link', { name: 'Send a reminder' })
    await expect(reminder).toBeVisible()

    // AC7: secondary, beneath the primary share, still at least 44px high.
    const share = page.getByRole('link', { name: 'Share to WhatsApp' })
    const shareBox = await share.boundingBox()
    const remindBox = await reminder.boundingBox()
    expect(remindBox?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(remindBox?.y ?? 0).toBeGreaterThan(shareBox?.y ?? 0)

    const body = bodyFromAnchor((await reminder.getAttribute('href')) ?? '')
    // Same header block as the share, a different last line naming a count and nobody (AC1, AC3).
    expect(body).toContain(`/#/event/${FAR.id}`)
    expect(body).toContain(`${String(awaiting)} still to answer. Yes or no:`)
    expect(body).not.toContain('Are you available?')
  })

  test('hands the native sheet the reminder text, no url (AC8)', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error test-only global
      window.__shared = undefined
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: (data: ShareData) => {
          // @ts-expect-error test-only global
          window.__shared = data
          return Promise.resolve()
        },
      })
    })

    await page.goto(`/#/manage/event/${FAR.id}`)
    const reminder = page.getByRole('link', { name: 'Send a reminder' })
    await expect(reminder).toBeVisible()
    const expected = bodyFromAnchor((await reminder.getAttribute('href')) ?? '')

    await reminder.click()
    const shared = await page.evaluate(() => {
      // @ts-expect-error test-only global
      const s = window.__shared as ShareData | undefined
      return s ? { text: s.text, hasUrl: 'url' in s } : null
    })
    expect(shared?.text).toBe(expected)
    expect(shared?.hasUrl).toBe(false)
  })
})
