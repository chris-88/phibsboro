/// <reference lib="dom" />
import { expect, test } from './fixtures.ts'
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { MANAGER_STATE } from './auth.setup.ts'

// S5.2, D17: local preview against the seeded stack, never the live site. Declan Ward (MANAGERS[0])
// manages Firsts; its "far" event is scheduled and ten days out, so the share control renders (AC8).
// HashRouter, so the event link lives after the `#`, which is exactly why the body must be encoded.
const FAR = eventFor(TEAM_FIRSTS.id, 'far')

// The anchor's href is `waMeUrl(message)` in every browser (AC3), so its decoded body is the exact
// message the app built — the source of truth both tests compare against without knowing the date.
function bodyFromAnchor(href: string): string {
  const prefix = 'https://wa.me/?text='
  expect(href.startsWith(prefix)).toBe(true)
  return decodeURIComponent(href.slice(prefix.length))
}

test.use({ storageState: MANAGER_STATE, viewport: { width: 375, height: 667 } })

test.describe('the share action (S5.2)', () => {
  test('hands the native sheet exactly { text }, no url (AC2, AC4)', async ({ page }) => {
    // Define navigator.share before the app loads, recording its argument (AC2 test plan).
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
    const link = page.getByRole('link', { name: 'Share to WhatsApp' })
    await expect(link).toBeVisible()

    // AC1: the control is at least 44px high and full width at 375px.
    const box = await link.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.width ?? 0).toBeGreaterThan(300)

    const expected = bodyFromAnchor((await link.getAttribute('href')) ?? '')

    await link.click()
    const shared = await page.evaluate(() => {
      // @ts-expect-error test-only global
      const s = window.__shared as ShareData | undefined
      return s ? { text: s.text, hasUrl: 'url' in s, hasTitle: 'title' in s } : null
    })
    expect(shared).not.toBeNull()
    expect(shared?.text).toBe(expected)
    expect(shared?.hasUrl).toBe(false)
    expect(shared?.hasTitle).toBe(false)
  })

  test('falls back to an encoded wa.me anchor with the link intact past the hash (AC3)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Remove the native sheet so the tap is a plain navigation.
      // @ts-expect-error deleting an optional DOM member
      delete navigator.share
    })

    await page.goto(`/#/manage/event/${FAR.id}`)
    const link = page.getByRole('link', { name: 'Share to WhatsApp' })
    await expect(link).toBeVisible()

    const href = (await link.getAttribute('href')) ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(href).toContain('%23%2Fevent%2F') // the hash route survives encoding
    expect(href).not.toContain('#') // no raw hash to truncate the body

    // The decoded body carries the whole message: emoji, location and the availability line.
    const body = bodyFromAnchor(href)
    expect(body).toContain(`/#/event/${FAR.id}`)
    expect(body).toContain('Are you available?')
    // The link is never actually followed; no external request leaves CI.
  })

  test('an AbortError leaves no error text on screen (AC5)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('', 'AbortError')),
      })
    })

    await page.goto(`/#/manage/event/${FAR.id}`)
    const link = page.getByRole('link', { name: 'Share to WhatsApp' })
    await link.click()

    await expect(page.getByText("Couldn't open WhatsApp. Copy the message instead.")).toHaveCount(0)
    await expect(link).toBeEnabled()
  })
})
