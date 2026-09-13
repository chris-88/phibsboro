/// <reference lib="dom" />
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { release, waitForControl } from './pwa-helpers'

// AC5, the load-bearing one (D43). With HashRouter every WhatsApp link is the same
// index.html, so one stale shell breaks every link the club has ever sent. This test proves a
// deploy reaches an open client within two reloads, and that the cached shell — the one an
// offline reload gets — is the new build too.

const ROOT = process.cwd()
const BUILDS = join(ROOT, '.playwright')
const DIST = join(ROOT, 'dist')

function build(name: string): void {
  execFileSync('npx', ['vite', 'build', '--outDir', join(BUILDS, name), '--emptyOutDir'], {
    cwd: ROOT,
    env: { ...process.env, VITE_SENTRY_RELEASE: name, VITE_BASE_PATH: '/' },
    stdio: 'pipe',
  })
}

/** Replaces what `vite preview` serves. It reads from disk per request, so this is a deploy. */
function serve(name: string): void {
  for (const entry of readdirSync(DIST)) rmSync(join(DIST, entry), { recursive: true, force: true })
  cpSync(join(BUILDS, name), DIST, { recursive: true })
}

test.beforeAll(() => {
  test.setTimeout(180_000)
  if (!existsSync(DIST))
    throw new Error('dist/ is missing: run `npm run build` before the pwa project')
  build('build-a')
  build('build-b')
})

test('a deploy reaches an open client within two reloads, and the cached shell moves with it', async ({
  page,
  context,
}) => {
  serve('build-a')
  await page.goto('/#/')
  expect(await release(page)).toBe('build-a')
  await waitForControl(page)
  // A first install claims the page without reloading it (registerServiceWorker.ts).
  await page.waitForTimeout(1500)
  expect(await release(page)).toBe('build-a')

  serve('build-b')

  // Reload one: navigations are network first, so the document is already build B while
  // worker A still controls the page and worker B installs behind it.
  await page.reload()
  expect(await release(page)).toBe('build-b')

  // Reload two is the app's own: worker B activates, takes control, and the page reloads
  // itself exactly once. A marker on the current document proves a new one arrived.
  await page.evaluate(() => {
    ;(window as Window & { __pfcDoc?: number }).__pfcDoc = 1
  })
  await page.waitForFunction(() => !('__pfcDoc' in window), undefined, { timeout: 15_000 })
  await page.waitForLoadState('load')
  expect(await release(page)).toBe('build-b')

  // ...and only once: no reload loop (AC11).
  await page.evaluate(() => {
    ;(window as Window & { __pfcDoc?: number }).__pfcDoc = 2
  })
  await page.waitForTimeout(2500)
  expect(await page.evaluate(() => (window as Window & { __pfcDoc?: number }).__pfcDoc)).toBe(2)

  // The shell the worker would serve without a network is build B's, not A's.
  await context.setOffline(true)
  await page.reload()
  expect(await release(page)).toBe('build-b')
  await expect(page.locator('#root')).not.toBeEmpty()
  await context.setOffline(false)
})
