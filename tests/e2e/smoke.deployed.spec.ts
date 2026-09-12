import { expect, test } from '@playwright/test'

// AC10 — runs against the live origin after a publish. Read-only by construction: it signs in to
// nothing and writes nothing, so it is safe to point at production.
//
// ROUTES is deliberately short. S0.3 owns routing and fills this list with the D34 routes in the
// same PR that removes the 404 skip below. Until then there is one route to check.
const ROUTES = ['/']

// S3.3 ships the real not-found state, at which point the unknown-route target becomes
// /#/event/00000000-0000-0000-0000-000000000000. Until S0.3 lands a 404 screen there is nothing
// to assert, so this stays skipped. S0.3 removes the skip.
const HAS_404_SCREEN = false

test('the site is up and serving this commit', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status(), 'the deployed site should return 200').toBe(200)

  const release = await page.locator('meta[name="pfc-release"]').getAttribute('content')
  const expected = process.env.EXPECTED_RELEASE
  if (expected) {
    expect(release, 'the deployed bundle should carry the commit that built it').toBe(expected)
  } else {
    expect(release, 'the release meta tag should be substituted at build time').toBeTruthy()
    expect(release).not.toBe('%VITE_SENTRY_RELEASE%')
  }
})

for (const route of ROUTES) {
  test(`${route} survives a hard reload`, async ({ page }) => {
    await page.goto(`/#${route}`)
    await page.reload()
    await expect(page.locator('#root')).not.toBeEmpty()
  })
}

test.skip(!HAS_404_SCREEN, 'an unknown route renders the 404 screen')
test('an unknown route renders the 404 screen', async ({ page }) => {
  test.skip(!HAS_404_SCREEN, 'S0.3 ships the 404 screen and removes this skip')
  await page.goto('/#/nope')
  await expect(page.getByText(/not found/i)).toBeVisible()
})
