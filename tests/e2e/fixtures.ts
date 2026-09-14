/// <reference lib="dom" />
import { test as base, expect } from '@playwright/test'

/**
 * The shared Playwright fixture (S7.1 AC7). Every app-behaviour spec imports `test` from here so an
 * `auto` fixture watches the page: any `pageerror` (an uncaught exception) or `console.error` fails
 * the test at teardown. A screen that throws, or logs an error a user would never see explained,
 * is a defect the sweep catches rather than a silent pass.
 *
 * The deliberately-offline PWA specs (`pwa-offline`, `pwa-update`) and the live-site smoke spec keep
 * the base `test`: driving the page offline emits expected transport errors, so a blanket page-error
 * assertion there would be a false failure.
 */
// A value-less auto fixture is typed `void` — Playwright's own idiom; the ban on `void` in a type
// position does not fit a fixture map, and this is unrelated to the AC5 promise rules.
// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export const test = base.extend<{ failOnPageError: void }>({
  failOnPageError: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(String(e)))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      await use()
      expect(errors, 'page emitted errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
