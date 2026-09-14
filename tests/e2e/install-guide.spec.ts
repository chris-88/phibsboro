/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test'
import { eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { PLAYER_STATE } from './auth.setup.ts'

// S2.8, D46: the non-webview leg of the journey. A seeded player on a mobile Chrome context opens an
// event deep link, answers, and meets the install card — never the escape prompt. No CI browser
// fires a real `beforeinstallprompt`, so a synthetic one is dispatched on `window` shortly after
// load; that is what the classification and the Install button both hinge on (D45). D17: local
// preview against the seeded stack, never the live site.

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.54 Mobile Safari/537.36'

const FAR = eventFor(TEAM_FIRSTS.id, 'far') // scheduled, 10 days out — responses open

const installLine = /put phibsboro on your home screen/i
const escapeLine = /open in safari to add this to your home screen/i

const yes = (page: Page) => page.getByRole('button', { name: 'Yes' })
const no = (page: Page) => page.getByRole('button', { name: 'No' })

test.use({
  storageState: PLAYER_STATE,
  userAgent: ANDROID_CHROME_UA,
  isMobile: true,
  hasTouch: true,
  viewport: { width: 390, height: 844 },
})

// A synthetic beforeinstallprompt: a real Event carrying a stubbed prompt() that records its calls
// and a userChoice resolving accepted. Dispatched after the provider's listener is up, inside its
// 3-second window, so the context resolves to `installable`.
const injectInstallPrompt = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const w = window as unknown as { __pfcPromptCalls: number }
    w.__pfcPromptCalls = 0
    setTimeout(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      event.prompt = () => {
        w.__pfcPromptCalls += 1
        return Promise.resolve()
      }
      event.userChoice = Promise.resolve({ outcome: 'accepted' as const })
      window.dispatchEvent(event)
    }, 500)
  })
}

const promptCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __pfcPromptCalls: number }).__pfcPromptCalls)

// Leave the seeded row as Yes so a rerun starts from the same place.
const restoreYes = async (page: Page): Promise<void> => {
  await page.goto(`/#/event/${FAR.id}`)
  await yes(page).click()
  await expect(yes(page)).toHaveAttribute('aria-pressed', 'true')
}

test.describe('add to home screen guide (S2.8)', () => {
  test('respond first, then the Install card, and only that card (AC1, AC5, AC14, D46)', async ({
    page,
  }) => {
    await injectInstallPrompt(page)
    await page.goto(`/#/event/${FAR.id}`)
    await expect(yes(page)).toBeVisible()

    // Nothing before a response (AC14). The seeded answer is Yes, so switch to No to force a write.
    await expect(page.getByText(installLine)).toHaveCount(0)
    await no(page).click()
    await expect(no(page)).toHaveAttribute('aria-pressed', 'true')

    // The install card, and never the escape prompt (AC1, D46).
    await expect(page.getByText(installLine)).toBeVisible()
    await expect(page.getByText(escapeLine)).toHaveCount(0)

    // The YES / NO buttons stay live with the card up (AC14).
    await expect(yes(page)).toBeEnabled()
    await expect(no(page)).toBeEnabled()

    // Install calls the captured event exactly once, then the card is gone (AC5, AC6).
    await page.getByRole('button', { name: 'Install' }).click()
    await expect.poll(() => promptCalls(page)).toBe(1)
    await expect(page.getByText(installLine)).toHaveCount(0)

    await restoreYes(page)
  })

  test('with no install event, the escape prompt shows instead — the same rule from the other side (D46)', async ({
    page,
  }) => {
    // No injected event: after the 3-second window Android classifies as android-inapp (D45).
    await page.goto(`/#/event/${FAR.id}`)
    await expect(yes(page)).toBeVisible()
    await no(page).click()
    await expect(no(page)).toHaveAttribute('aria-pressed', 'true')

    await expect(page.getByText(escapeLine)).toBeVisible()
    await expect(page.getByText(installLine)).toHaveCount(0)

    await restoreYes(page)
  })
})
