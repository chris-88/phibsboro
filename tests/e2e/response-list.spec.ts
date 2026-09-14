/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { E2E_RESERVED_PREFIX, eventFor, TEAM_FIRSTS } from '../../supabase/seed/fixtures.ts'
import { MANAGER_STATE } from './auth.setup.ts'

// S4.4, D17: local preview against the seeded stack, never the live site. Declan Ward (MANAGERS[0])
// manages Firsts. Its imminent event has 6 available (incl. Declan), 3 unavailable, 3 awaiting
// (Ian, Jack, Karl), plus one leaver response excluded by buildRoster (D22, D33). HashRouter.
const IMMINENT = eventFor(TEAM_FIRSTS.id, 'imminent')

// Awaiting first, then available, then unavailable; within each group by name (AC3).
const AWAITING_FIRST = ['Ian Keogh', 'Jack Dunne', 'Karl Reilly']

test.use({ storageState: MANAGER_STATE, viewport: { width: 375, height: 667 } })

test.describe('the manager response list (S4.4)', () => {
  test('lists the squad awaiting-first, at 375px, with no phone and inert controls', async ({
    page,
  }) => {
    // AC9: exactly one request each for the directory and the responses on a single load.
    let directoryCalls = 0
    let responseCalls = 0
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/rpc/team_member_directory')) directoryCalls += 1
      if (url.includes('/rest/v1/event_responses')) responseCalls += 1
    })

    await page.goto(`/#/manage/event/${IMMINENT.id}`)

    const list = page.locator('ul:has(button[role="radio"])')
    await expect(list.getByRole('listitem')).toHaveCount(12) // AC1: 12 members, leaver dropped (AC4)

    // AC3: the three awaiting members are the first three cards, in name order.
    for (const [i, name] of AWAITING_FIRST.entries()) {
      await expect(list.getByRole('listitem').nth(i)).toContainText(name)
    }

    // AC7: every attendance control is rendered and disabled in this read-only story.
    const notRecorded = list.getByRole('radio', { name: 'Not recorded' })
    await expect(notRecorded.first()).toBeDisabled()

    // AC8: no seeded phone number appears anywhere on the page.
    await expect(page.locator('body')).not.toContainText(E2E_RESERVED_PREFIX)

    // AC5: no horizontal scroll at 375px, even with the longest seeded names.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)

    // AC9: one directory read, one responses read.
    expect(directoryCalls).toBe(1)
    expect(responseCalls).toBe(1)
  })
})
