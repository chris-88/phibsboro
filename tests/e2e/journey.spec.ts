/// <reference lib="dom" />
import { expect, test } from './fixtures.ts'
import type { BrowserContext, Page } from '@playwright/test'
import {
  E2E_RESERVED_PREFIX,
  MANAGERS,
  MEMBERSHIPS,
  SEED_PASSWORD,
  TEAM_FIRSTS,
} from '../../supabase/seed/fixtures.ts'
import { PREVIEW_URL } from './pwa-helpers.ts'
// The real Dublin formatter and the wall-time composer, imported so the date line and the event's
// UTC instant are computed one way, never reimplemented in the test. time.ts has no imports of its
// own, so it loads in Playwright's node runtime; shareMessage.ts cannot (it reaches env.ts, which
// validates import.meta.env at load and has none here) — see the deviations note in the story.
import { dublinLocalToUtcIso, formatEventTime } from '@/lib/time'

// S7.3, D17: the one test that walks the whole product — create → share → tap link → register →
// land on the event → YES → the manager sees the count move → the manager records attendance.
// Local preview against the seeded local stack, never the live site (D58). This project runs only
// when RUN_LOCAL_STACK enables the seeded preview (see CI); it is wired here, its live run deferred
// with the rest of the e2e job. HashRouter throughout, so every route carries `#`.

const MANAGER = MANAGERS[0] // Declan Ward, manages Firsts

// The event the manager creates. A distinct title so it is unmistakable on the event and in the
// share text; a sentinel note so AC4 can prove the cold-arrival preview never leaks it.
const MATCH_TITLE = 'E2E S7.3 Cup Final'
const MATCH_LOCATION = 'Dalymount Park'
const SECRET_NOTES = 'SECRET-NOTES-DO-NOT-LEAK'

// The brand-new player. The name is asserted in the manager's response list (AC8); the number is
// run-scoped from the reserved E2E range (+3538990…, D58), so a rerun without a reset never blocks
// on the phone unique constraint (AC13).
const NEW_PLAYER_NAME = 'Journey Tester'
const RUN = String(process.env.GITHUB_RUN_NUMBER ?? Date.now())
  .slice(-5)
  .padStart(5, '0')
const NEW_PLAYER_PHONE = `${E2E_RESERVED_PREFIX}${RUN}`

// Derived from the seed layout, never typed as a literal: Firsts' manager plus players 1–10 and the
// multi-team player is twelve. The new player makes thirteen. If the seed layout changes, this
// breaks loudly rather than asserting the wrong total (AC7).
const SEEDED_SQUAD = MEMBERSHIPS.filter((m) => m.teamId === TEAM_FIRSTS.id).length

/** The next Saturday at 14:00 Dublin, always comfortably in the future, so the D12 response cut-off
 *  never bites. The calendar date is found in UTC so the weekday is stable whatever TZ the node
 *  process runs in; the app composes it as Dublin wall time. */
function nextSaturday(): string {
  const d = new Date(Date.now() + 3 * 86_400_000)
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const yes = (page: Page) => page.getByRole('button', { name: /^yes$/i })
const no = (page: Page) => page.getByRole('button', { name: /^no$/i })

/** A synthetic beforeinstallprompt, shaped as the S2.8 provider expects, dispatched shortly after
 *  load so the Android-Chrome context resolves `installable` and a real Install button appears
 *  (AC1, D45). The same shape the install-guide spec uses. */
async function injectInstallPrompt(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    setTimeout(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      event.prompt = () => Promise.resolve()
      event.userChoice = Promise.resolve({ outcome: 'accepted' as const })
      window.dispatchEvent(event)
    }, 500)
  })
}

/** Reads a count tile by the test id S7.3 adds to EventCountsPanel. */
const countOf = (page: Page, key: 'available' | 'unavailable' | 'awaiting' | 'squad') =>
  page.getByTestId(`count-${key}`)

const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.54 Mobile Safari/537.36'

test.describe('the full MVP journey (S7.3)', () => {
  test('create → share → tap → register → YES → counts move → attendance recorded', async ({
    page: managerPage,
    browser,
  }) => {
    // ---- The manager, in the first context. `navigator.share` is stubbed so the share is
    // provable and never opens WhatsApp; the message is captured on window.__shared (AC2). ----
    await managerPage.addInitScript(() => {
      const w = window as unknown as { __shared: string[] }
      w.__shared = []
      Object.defineProperty(navigator, 'share', {
        value: (d: ShareData) => {
          w.__shared.push(d.text ?? '')
          return Promise.resolve()
        },
        configurable: true,
      })
    })

    // Manager signs in (AC1).
    await managerPage.goto('/#/')
    await managerPage.locator('#sign-in-phone').fill(MANAGER.phone)
    await managerPage.locator('#sign-in-password').fill(SEED_PASSWORD)
    await managerPage.getByRole('button', { name: /^sign in$/i }).click()
    await expect(managerPage.locator('#sign-in-phone')).toHaveCount(0)

    // Manager creates this coming Saturday's match (AC1).
    const date = nextSaturday()
    const time = '14:00'
    const startsAtIso = dublinLocalToUtcIso(date, time)

    await managerPage.goto('/#/manage/event/new')
    await expect(managerPage.getByLabel('Title')).toBeVisible()
    // Pick Match first: it rewrites a default title, so the custom title is filled afterwards.
    await managerPage.getByRole('radio', { name: 'Match' }).click()
    await managerPage.getByLabel('Title').fill(MATCH_TITLE)
    await managerPage.getByLabel('Date').fill(date)
    await managerPage.getByLabel('Start time').fill(time)
    await managerPage.getByLabel('Location').fill(MATCH_LOCATION)
    await managerPage.getByLabel(/notes/i).fill(SECRET_NOTES)
    await managerPage.getByRole('button', { name: 'Add event' }).click()

    // Lands on the manager view of the new event; its id is the one in the address bar (AC2).
    await expect(managerPage).toHaveURL(/#\/manage\/event\/[0-9a-f-]{36}$/)
    const eventId = /#\/manage\/event\/([0-9a-f-]{36})$/.exec(managerPage.url())?.[1]
    expect(eventId, 'the new event id is in the manager URL').toBeTruthy()
    if (eventId === undefined) throw new Error('unreachable: no event id in URL')

    // Manager shares it (AC1). The stubbed native sheet records the message.
    await managerPage.getByRole('link', { name: 'Share to WhatsApp' }).click()
    const captured = await managerPage.evaluate(
      () => (window as unknown as { __shared: string[] }).__shared[0] ?? '',
    )

    // AC2: the captured message has the exact D13 shape, checked line by line against the values
    // the test created and the real Dublin formatter — the ⚽ first character, the date line equal
    // to formatEventTime(starts_at, 'share'), the location, the note, a blank line, then the
    // "Are you available? {url}" line. Notes are present, so this is the six-line variant. The
    // byte-for-byte output of buildShareMessage() is already locked by S5.1's unit test.
    const lines = captured.split('\n')
    expect(lines).toHaveLength(6)
    expect(lines[0]).toBe(`⚽ ${MATCH_TITLE}`)
    expect(lines[1]).toBe(formatEventTime(startsAtIso, 'share'))
    expect(lines[2]).toBe(MATCH_LOCATION)
    expect(lines[3]).toBe(SECRET_NOTES)
    expect(lines[4]).toBe('')
    expect(lines[5]).toMatch(/^Are you available\? https?:\/\/\S+#\/event\/[0-9a-f-]{36}$/)

    // The link the new user opens is extracted from the captured message, never constructed here.
    const linkMatch = /https?:\/\/\S+#\/event\/([0-9a-f-]{36})/.exec(captured)
    const sharedUrl = linkMatch?.[0]
    expect(sharedUrl, 'the share text carries an /#/event/{uuid} link').toBeTruthy()
    if (sharedUrl === undefined) throw new Error('unreachable: no event link in share text')
    expect(linkMatch?.[1]).toBe(eventId) // the id in the link equals the id in the address bar (AC2)

    // ---- The brand-new player, in a clean, isolated context on Android Chrome. ----
    const playerContext = await browser.newContext({
      baseURL: PREVIEW_URL,
      userAgent: ANDROID_CHROME_UA,
      isMobile: true,
      hasTouch: true,
      viewport: { width: 390, height: 844 },
    })
    // AC3: no cookies, no localStorage, no service worker carried from the manager's context.
    // Read before the first navigation writes anything — there is no document to inspect yet, so
    // the isolated storage is asserted through the context's own state.
    expect((await playerContext.storageState()).origins).toEqual([])
    await injectInstallPrompt(playerContext)

    const playerPage = await playerContext.newPage()
    // The player context is outside the failOnPageError auto fixture, so watch it here too.
    const playerErrors: string[] = []
    playerPage.on('pageerror', (e) => playerErrors.push(String(e)))
    playerPage.on('console', (m) => {
      if (m.type() === 'error') playerErrors.push(m.text())
    })

    // Cold arrival from the shared link.
    await playerPage.goto(sharedUrl)

    // AC4: the D7 preview — team, type, title, location and date line, one primary "Join Firsts"
    // button, and never the notes nor an availability control.
    await expect(playerPage.getByText(TEAM_FIRSTS.name, { exact: true })).toBeVisible()
    await expect(playerPage.getByRole('heading', { name: MATCH_TITLE })).toBeVisible()
    await expect(playerPage.getByText(MATCH_LOCATION)).toBeVisible()
    await expect(playerPage.getByText(formatEventTime(startsAtIso, 'share'))).toBeVisible()
    const join = playerPage.getByRole('button', {
      name: new RegExp(`join ${TEAM_FIRSTS.name}`, 'i'),
    })
    await expect(join).toBeVisible()
    await expect(playerPage.locator('body')).not.toContainText(SECRET_NOTES)
    await expect(yes(playerPage)).toHaveCount(0)
    await expect(no(playerPage)).toHaveCount(0)

    // Register: three fields and one button (AC1).
    await join.click()
    await expect(playerPage).toHaveURL(/#\/register$/)
    await playerPage.locator('#register-name').fill(NEW_PLAYER_NAME)
    await playerPage.locator('#register-phone').fill(NEW_PLAYER_PHONE)
    await playerPage.locator('#register-password').fill('correct horse battery staple')
    await playerPage.getByRole('button', { name: /create account/i }).click()

    // AC5: back on that exact event as a member, not on home.
    await expect(playerPage).toHaveURL(new RegExp(`#/event/${eventId}$`))
    await expect(playerPage.getByRole('heading', { name: MATCH_TITLE })).toBeVisible()

    // Taps YES (AC1). Optimistic, then the confirmation line.
    await yes(playerPage).click()
    await expect(yes(playerPage)).toHaveAttribute('aria-pressed', 'true')
    await expect(playerPage.getByText(/you said yes/i)).toBeVisible()

    // AC1 install guide: on Android Chrome with the synthetic beforeinstallprompt, the install card
    // and a real Install button appear, and never the escape prompt.
    await expect(playerPage.getByText(/put phibsboro on your home screen/i)).toBeVisible()
    await expect(playerPage.getByRole('button', { name: 'Install' })).toBeVisible()
    await expect(
      playerPage.getByText(/open in safari to add this to your home screen/i),
    ).toHaveCount(0)

    // ---- The manager, still open on the event, sees the count move (AC7). ----
    await managerPage.bringToFront()
    // The raised timeout is on this assertion only, so the 30s poll (D23) is a fallback, not a
    // failure; the focus from bringToFront triggers the refetch first.
    await expect(countOf(managerPage, 'available')).toHaveText('1', { timeout: 35_000 })
    await expect(countOf(managerPage, 'unavailable')).toHaveText('0')
    await expect(countOf(managerPage, 'squad')).toHaveText(String(SEEDED_SQUAD + 1))

    const read = (loc: ReturnType<typeof countOf>) =>
      loc.textContent().then((t) => Number(t?.trim()))
    const [available, unavailable, awaiting, squad] = await Promise.all([
      read(countOf(managerPage, 'available')),
      read(countOf(managerPage, 'unavailable')),
      read(countOf(managerPage, 'awaiting')),
      read(countOf(managerPage, 'squad')),
    ])
    expect(available).toBe(1)
    expect(squad).toBe(SEEDED_SQUAD + 1)
    expect(available + unavailable + awaiting).toBe(squad)

    // AC8: the new player's name is in the response list (from team_member_directory) with an
    // Available pill — which also proves the directory RPC is reachable to a manager.
    const playerRow = managerPage.getByRole('listitem').filter({ hasText: NEW_PLAYER_NAME }).first()
    await expect(playerRow).toBeVisible()
    await expect(playerRow.getByText('Available')).toBeVisible()

    // AC6: the YES survives a full reload, proving the write reached Postgres, not only the cache.
    await playerPage.reload()
    await expect(yes(playerPage)).toHaveAttribute('aria-pressed', 'true')

    // ---- The manager records attendance (AC9). ----
    await managerPage.bringToFront()
    await playerRow.getByRole('radio', { name: 'Attended' }).click()
    await expect(playerRow.getByRole('radio', { name: 'Attended' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    // Survives a reload: the segmented control still reads attended.
    await managerPage.reload()
    const reloadedRow = managerPage
      .getByRole('listitem')
      .filter({ hasText: NEW_PLAYER_NAME })
      .first()
    await expect(reloadedRow.getByRole('radio', { name: 'Attended' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // And the row the UI wrote, read back with the service role: attended, recorded by the manager.
    // Imported lazily so collecting the suite without a running local stack (this project is
    // deferred behind RUN_LOCAL_STACK) never evaluates the service-role target at module load.
    const { adminClient, userIdByPhone } = await import('../helpers/admin.ts')
    const managerId = await userIdByPhone(MANAGER.phone)
    const playerId = await userIdByPhone(NEW_PLAYER_PHONE)
    const { data, error } = await adminClient()
      .from('attendance')
      .select('attended, recorded_by')
      .eq('event_id', eventId)
      .eq('user_id', playerId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.attended).toBe(true)
    expect(data?.[0]?.recorded_by).toBe(managerId)

    expect(playerErrors, 'the player page emitted errors').toEqual([])
    await playerContext.close()
  })
})
