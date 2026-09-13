import { expect, test } from '@playwright/test'

// AC10 — runs against the live origin after a publish. Read-only by construction: it signs in to
// nothing and writes nothing, so it is safe to point at production.
//
// Every URL here is relative with no leading slash. SMOKE_BASE_URL is the Pages project page,
// https://chris-88.github.io/phibsboro/, and Playwright resolves a leading-slash URL against the
// origin, which would drop /phibsboro/ and test somebody else's 404.

const UUID = '9f1c0b8e-0000-4000-8000-000000000000'

// The D34 route list, each with a real segment value (S0.3 AC1, AC5).
const ROUTES = [
  '/',
  '/login',
  '/register',
  '/join/abc123',
  '/reset/abc123',
  `/event/${UUID}`,
  '/history',
  '/manage',
  '/manage/event/new',
  `/manage/event/${UUID}`,
  `/manage/team/${UUID}/members`,
  '/admin',
]

const TITLE_SUFFIX = ' · Phibsboro FC'
const NOT_FOUND_TITLE = `Nothing here.${TITLE_SUFFIX}`

// S3.3 ships the real not-found state for an unknown event, at which point this becomes
// `/event/00000000-0000-0000-0000-000000000000` (D17). Until then that path renders the S3.3
// placeholder, so the unknown-route target is a path no story will ever claim.
const UNKNOWN_ROUTE = '/nope'

test('the site is up and serving this commit', async ({ page }) => {
  const response = await page.goto('')
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
    const first = await page.goto(`#${route}`)
    expect(first?.status()).toBe(200)
    const second = await page.reload()
    expect(second?.status(), 'a hash route must never reach the server as a path').toBe(200)
    await expect(page.locator('#root')).not.toBeEmpty()
    // Each route sets its own title, so the suffix proves the route table resolved it and the
    // not-found title proves it did not fall through to `*`.
    await expect(page).toHaveTitle(new RegExp(`${TITLE_SUFFIX}$`))
    await expect(page).not.toHaveTitle(NOT_FOUND_TITLE)
  })
}

test('an unknown route renders the 404 screen', async ({ page }) => {
  await page.goto(`#${UNKNOWN_ROUTE}`)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Nothing here.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Go to the app' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page).toHaveTitle(NOT_FOUND_TITLE)
})

// S0.3 AC7 — a link that lost its `#` is caught by 404.html and put back together.
test('the path form of an event link redirects to the hash form', async ({ page }) => {
  await page.goto(`event/${UUID}`)
  await expect(page).toHaveURL(new RegExp(`/#/event/${UUID}$`))
  await expect(page.locator('#root')).not.toBeEmpty()
  await expect(page).toHaveTitle(new RegExp(`${TITLE_SUFFIX}$`))
})
