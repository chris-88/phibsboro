/// <reference lib="dom" />
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect, test } from '@playwright/test'
import { EVENT_ID, PREVIEW_URL, TITLE_SUFFIX, release, waitForControl } from './pwa-helpers'

// AC6 and AC8 against whatever dist/ holds, plus the AC4 installability verdict from
// Chromium itself. Each test opens its own context, so the worker starts uninstalled.

test('with the worker active and the network offline, a reload renders the shell (AC6)', async ({
  page,
  context,
}) => {
  await page.goto('/#/')
  await waitForControl(page)
  const online = await release(page)

  await context.setOffline(true)
  const response = await page.reload()
  expect(response?.fromServiceWorker(), 'the worker answered the navigation').toBe(true)
  await expect(page.locator('#root')).not.toBeEmpty()
  await expect(page).toHaveTitle(new RegExp(`${TITLE_SUFFIX}$`))
  expect(await release(page)).toBe(online)
  await context.setOffline(false)
})

test('a cold hard load of an event link resolves to the event while controlled (AC8)', async ({
  page,
  context,
}) => {
  await page.goto('/#/')
  await waitForControl(page)

  // A second page in the same origin is a cold document; with clientsClaim it is controlled
  // from its first byte, exactly like a WhatsApp tap after the app was installed.
  const cold = await context.newPage()
  const response = await cold.goto(`/#/event/${EVENT_ID}`)
  expect(response?.fromServiceWorker()).toBe(true)
  expect(await cold.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
  await expect(cold).toHaveURL(new RegExp(`/#/event/${EVENT_ID}$`))
  await expect(cold).toHaveTitle(`Event${TITLE_SUFFIX}`)
  await expect(cold.getByRole('heading', { name: 'Nothing here.' })).toHaveCount(0)

  // And the same tap in a tunnel: the shell still lands on the event, not the offline page.
  await context.setOffline(true)
  await cold.reload()
  await expect(cold).toHaveURL(new RegExp(`/#/event/${EVENT_ID}$`))
  await expect(cold).toHaveTitle(`Event${TITLE_SUFFIX}`)
  await expect(cold.getByRole('heading', { name: 'Nothing here.' })).toHaveCount(0)
  await context.setOffline(false)
})

test('the manifest is linked and the worker scope covers the start URL', async ({ page }) => {
  await page.goto('/#/')
  await waitForControl(page)
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/manifest.webmanifest')

  const manifest = await page.request.get('/manifest.webmanifest')
  expect(manifest.ok()).toBe(true)
  const body = (await manifest.json()) as { start_url: string; scope: string; id: string }
  expect(body).toMatchObject({ start_url: '/', scope: '/', id: '/' })

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toBe(`${PREVIEW_URL}/`)
  const registeredScript = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).active?.scriptURL,
  )
  expect(registeredScript).toBe(`${PREVIEW_URL}/sw.js`)
})

// D44 names Lighthouse's installable-manifest audit, which Lighthouse 12 removed. That audit
// was a wrapper around Chromium's own verdict, Page.getInstallabilityErrors, asked here
// directly: an empty list is Chromium saying the install prompt may be shown (AC4). It needs
// the full Chromium build, not the headless shell, and a real profile — an incognito context
// is reported as its own installability error, and the shell has no installability manager
// at all and answers [] for anything. The second half proves the verdict is not vacuous.
test('Chromium reports no installability errors (AC4)', async () => {
  // A fresh profile per verdict: Chromium remembers an origin's verdict within a profile.
  const verdict = async (expected: (ids: string[]) => boolean) => {
    const profile = mkdtempSync(join(tmpdir(), 'pfc-pwa-profile-'))
    const browser = await chromium.launchPersistentContext(profile, { channel: 'chromium' })
    try {
      const page = await browser.newPage()
      const cdp = await browser.newCDPSession(page)
      await page.goto(`${PREVIEW_URL}/#/`)
      await waitForControl(page)
      const manifest = await cdp.send('Page.getAppManifest')
      expect(manifest.url).toBe(`${PREVIEW_URL}/manifest.webmanifest`)
      let ids: string[] = []
      await expect
        .poll(
          async () => {
            const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
            ids = installabilityErrors.map((e) => e.errorId)
            return expected(ids)
          },
          { timeout: 10_000 },
        )
        .toBe(true)
      return ids
    } finally {
      await browser.close()
      rmSync(profile, { recursive: true, force: true })
    }
  }
  const manifestFile = join(process.cwd(), 'dist', 'manifest.webmanifest')
  const original = readFileSync(manifestFile, 'utf8')
  try {
    expect(await verdict((ids) => ids.length === 0)).toEqual([])

    // Not vacuous: the same probe must see a manifest Chromium refuses to install.
    const uninstallable = {
      ...(JSON.parse(original) as Record<string, unknown>),
      display: 'browser',
    }
    writeFileSync(manifestFile, JSON.stringify(uninstallable))
    expect(await verdict((ids) => ids.length > 0)).toContain('manifest-display-not-supported')
  } finally {
    writeFileSync(manifestFile, original)
  }
})
