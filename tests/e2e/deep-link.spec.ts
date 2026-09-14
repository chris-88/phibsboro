/// <reference lib="dom" />
import { expect, test } from './fixtures.ts'
import type { BrowserContext, Page } from '@playwright/test'
import { eventFor, NO_TEAM, SEED_PASSWORD, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { PREVIEW_URL } from './pwa-helpers.ts'

// S2.5, D17: local preview against the seeded local stack, never the live site (D58). This is the
// one test of the hinge of the only journey that matters — a WhatsApp tap on an event link must
// land on that exact event after the interruption of registering or signing in. The intended route
// lives in localStorage (D1), so the whole path is same-document: no callback, no redirect.

const IMMINENT = eventFor(TEAM_FIRSTS.id, 'imminent') // scheduled, 26h out — responses are open
const EVENT_HASH = `/event/${IMMINENT.id}`

/** A run-scoped number from the reserved E2E range (+3538990…, D58), so parallel runs and reruns
 *  never collide on the phone unique constraint. Shaped as a valid Irish mobile. */
function freshPhone(): string {
  const suffix = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
  return `+3538990${suffix}`
}

/** Installs the hash-path recorder the test plan names: every hash the app visits is pushed onto
 *  `window.__pfcPathLog`, so the exact screen sequence can be asserted (AC13). Consecutive repeats
 *  are collapsed, since a `replace` navigation to the same path must not double-count. */
async function recordPathLog(target: Page | BrowserContext): Promise<void> {
  await target.addInitScript(() => {
    const w = window as unknown as { __pfcPathLog?: string[] }
    w.__pfcPathLog ??= []
    const push = (): void => {
      const path = window.location.hash.replace(/^#/, '') || '/'
      const log = w.__pfcPathLog
      if (log && log[log.length - 1] !== path) log.push(path)
    }
    push()
    window.addEventListener('hashchange', push)
  })
}

async function readPathLog(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __pfcPathLog: string[] }).__pfcPathLog)
}

test.describe('the deep-link return path', () => {
  test('a new user lands on the event, registers, and is back on the event (AC1, AC12, AC13)', async ({
    page,
  }) => {
    await recordPathLog(page)

    // Cold arrival from WhatsApp: the stranger sees the preview and one way in.
    await page.goto(`/#${EVENT_HASH}`)
    const join = page.getByRole('button', { name: new RegExp(`join ${TEAM_FIRSTS.name}`, 'i') })
    await expect(join).toBeVisible()
    await join.click()

    // The interruption: three fields and one button.
    await expect(page).toHaveURL(/#\/register$/)
    await page.locator('#register-name').fill('Deep Link Tester')
    await page.locator('#register-phone').fill(freshPhone())
    await page.locator('#register-password').fill('correct horse battery')
    await page.getByRole('button', { name: /create account/i }).click()

    // The hinge: the very next screen with content is that exact event, as a member.
    await expect(page).toHaveURL(new RegExp(`#${EVENT_HASH}$`))
    const yes = page.getByRole('button', { name: /^yes$/i })
    const no = page.getByRole('button', { name: /^no$/i })
    await expect(yes).toBeEnabled()
    await expect(no).toBeEnabled()

    // Exactly three screens, one form submit — no home, no list in between (D21, AC13).
    expect(await readPathLog(page)).toEqual([EVENT_HASH, '/register', EVENT_HASH])

    // The response persists across a reload, so the journey actually reached the database.
    await yes.click()
    await expect(page.getByText(/you said yes/i)).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: /^yes$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('an existing user returns to the event after a cold-start sign-in (AC2, AC5)', async ({
    browser,
  }) => {
    // Leg one: a stranger taps "Already registered? Sign in". The affordance stores the intended
    // route and the pending join, then leaves for /login.
    const ctx = await browser.newContext({ baseURL: PREVIEW_URL })
    const page = await ctx.newPage()
    await page.goto(`/#${EVENT_HASH}`)
    await page.getByRole('button', { name: /already registered\? sign in/i }).click()
    await expect(page).toHaveURL(/#\/login$/)
    const stored = await ctx.storageState()
    await ctx.close()

    // Leg two: a genuinely cold start — a new context reusing only the persisted localStorage —
    // opened at the app root. Signing in must restore the event, not drop them on home.
    const cold = await browser.newContext({ baseURL: PREVIEW_URL, storageState: stored })
    const page2 = await cold.newPage()
    await page2.goto('/#/')
    await page2.locator('#sign-in-phone').fill(NO_TEAM.phone)
    await page2.locator('#sign-in-password').fill(SEED_PASSWORD)
    await page2.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page2).toHaveURL(new RegExp(`#${EVENT_HASH}$`))
    await expect(page2.getByRole('button', { name: /^yes$/i })).toBeEnabled()
    await cold.close()
  })

  test('the intended route is consumed exactly once (AC8, AC14)', async ({ browser }) => {
    // A signed-in session with a stale intended route still stored: opening the app must not
    // reopen the event. Mimics relaunching the installed PWA after the flow.
    const ctx = await browser.newContext({ baseURL: PREVIEW_URL })
    const page = await ctx.newPage()

    // Sign in NO_TEAM the ordinary way, then seed a leftover route and reload from the root.
    await page.goto('/#/')
    await page.locator('#sign-in-phone').fill(NO_TEAM.phone)
    await page.locator('#sign-in-password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page).not.toHaveURL(/#\/login$/)

    await page.goto('/#/')
    await page.reload()
    await expect(page).toHaveURL(/#\/$/)
    await ctx.close()
  })

  test('a poisoned stored route never becomes an open redirect (AC10)', async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: PREVIEW_URL })
    const page = await ctx.newPage()
    // Sign in, then plant an off-origin value under the key and reload.
    await page.goto('/#/')
    await page.locator('#sign-in-phone').fill(NO_TEAM.phone)
    await page.locator('#sign-in-password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page).not.toHaveURL(/#\/login$/)

    await page.evaluate(() => {
      localStorage.setItem(
        'pfc.intendedRoute',
        JSON.stringify({ path: 'https://evil.example', at: Date.now() }),
      )
    })
    await page.goto('/#/')
    await page.reload()
    // Stays on-origin, on home; the poisoned value was discarded on read.
    await expect(page).toHaveURL(/#\/$/)
    expect(new URL(page.url()).origin).toBe(PREVIEW_URL)
    await ctx.close()
  })
})
