/// <reference lib="dom" />
import type { Page } from '@playwright/test'

/** Where playwright.config.ts previews dist/ (D17). */
export const PREVIEW_URL = 'http://127.0.0.1:4173'
export const EVENT_ID = '9f1c0b8e-0000-4000-8000-000000000000'
export const TITLE_SUFFIX = ' · Phibsboro FC'

/** The build the document on screen came from — S0.5's pfc-release meta. */
export const release = (page: Page) =>
  page.locator('meta[name="pfc-release"]').getAttribute('content')

/** Resolves once a service worker is active and controlling this page. */
export async function waitForControl(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}
