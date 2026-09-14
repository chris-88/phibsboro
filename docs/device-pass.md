# Device pass (S7.4)

The manual check that a real person, on real hardware, taps a real WhatsApp message and gets all the way
through. Everything the product claims that a headless browser cannot prove is proved here, once, in
writing, before release ([D56](../spec/00-decisions.md)).

This story ships the **checklist**. The **run on hardware** is the reviewer's — the sections below are
templates with every step unticked. Sign off is by filling in a dated section per device, committing this
file, committing the screenshot from step 3/AC10, and pasting the filled table into the PR. Keep prior
passes: append a new dated section rather than overwriting, so a regression across releases is visible. The
step numbering is fixed and never changes between passes, so two passes diff cleanly.

## Before you start

1. **Deploy first.** The pass runs against the **live site** `https://app.phibsboro.ie` from `main`
   ([S0.5](../spec/stories/S0.5-deployment.md)) — it is the only story that runs against production, and
   that is the point. Real WhatsApp, real DNS, real service-worker behaviour is exactly what this exists to
   check.
2. **Throwaway team.** Create a team named `Device pass` through the admin Teams screen
   ([S6.1](../spec/stories/S6.1-teams.md)) so the pass never writes into a real squad. Deactivate it when
   the pass is signed off ([D50](../spec/00-decisions.md)) — never delete; teams are not hard-deleted, and
   deactivation hides it from every non-admin while its events, responses and attendance stay readable to
   admins.
3. **Reserved numbers.** Every test registration uses a number from the reserved range: `+3538990` plus a
   five-digit run-scoped suffix, e.g. `+353899012345` ([D58](../spec/00-decisions.md)). These are
   deliberately not dialable and no real player is ever assigned that range.
4. **A real message.** Use a second WhatsApp account, or a group containing only the tester. Do **not** use
   a squad group.
5. **Two phones.** One current iPhone on current iOS Safari. One **mid-range** Android on current Chrome —
   a Samsung A-series, a Pixel A, or a Moto G of the current or previous generation. A flagship measures
   nothing useful for the timing check (AC12/step 18). Record the exact model.
6. **The release string** is the `pfc-release` meta value. Read it from the version tag in the app footer,
   or view-source the live page.

## Reading the checklist

Each numbered step maps to one or more acceptance criteria from the story. Fill `Result` with `pass` or
`fail`, and put a note on anything that needs one. **No cell is left blank** ([D56](../spec/00-decisions.md)).
A `fail` note must name the story that owns the fix (AC18); the pass is not signed off until that fix has
landed in its owning story and the affected section has been re-run and re-recorded.

| #   | Step                                                                               | Devices | Covers   | What "pass" looks like                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Manager creates a match on the live site from the phone                            | both    | —        | The event appears in the team's list immediately                                                                                                                                                                                                   |
| 2   | Manager shares it; native share sheet opens; WhatsApp offered                      | both    | AC10     | `navigator.share()` sheet opens with WhatsApp in the row                                                                                                                                                                                           |
| 3   | Message arrives in the group; [D13](../spec/00-decisions.md) format; link tappable | both    | AC10     | Five/six lines, `⚽`/`🏃`, Dublin date line, location, `/#/event/{id}` link whole and blue/tappable. **Screenshot the received message and commit it**                                                                                             |
| 4   | Signed-out tap of the link; cold preview correct; **no notes**                     | both    | AC2, AC3 | Team name, title, date line, location, one `Join {team}` button, and **no notes** ([D7](../spec/00-decisions.md))                                                                                                                                  |
| 5   | Register: name, number, password; land on the **exact** event                      | both    | AC2      | Three fields, one button; after submit you land back on that same event, signed in                                                                                                                                                                 |
| 6   | Tap YES; confirmation visible                                                      | both    | AC2      | The YES state is visibly selected                                                                                                                                                                                                                  |
| 7   | Escape prompt (iOS webview) **or** install guide (Android Chrome) — never both     | both    | AC4, AC6 | iOS WhatsApp webview → only the escape prompt. Android Chrome → the Install button or the written fallback ([D45](../spec/00-decisions.md), [D46](../spec/00-decisions.md)). Record which branch fired                                             |
| 8   | Copy link, open in Safari, sign in once more, install guide appears                | iPhone  | AC4, AC5 | Copy button copies the **app root** (not the event); copy says "you'll sign in once more" ([D47](../spec/00-decisions.md)); pasting into Safari lands on sign-in, then the [S2.8](../spec/stories/S2.8-add-to-home-screen-guide.md) guide appears  |
| 9   | Add to Home Screen; icon is the 180x180 asset                                      | both    | AC5, AC6 | iOS guide shows the real iOS share icon; installed icon is the `apple-touch-icon`, **not** a screenshot of the page                                                                                                                                |
| 10  | Launch from home screen: standalone, no prompts                                    | both    | AC7      | No browser chrome, no address bar; neither escape prompt nor install guide appears ([D44](../spec/00-decisions.md), [D46](../spec/00-decisions.md))                                                                                                |
| 11  | Force-quit, relaunch: response still shows as YES                                  | both    | AC2      | The YES persists after a full quit and reopen                                                                                                                                                                                                      |
| 12  | Tap a **second** event link while installed; record which surface opens it         | both    | AC9      | The event opens. Record whether it opened in the installed app or the browser — it differs by platform and is worth writing down                                                                                                                   |
| 13  | Manager view: counts correct; response list readable; record attendance            | Android | AC11     | Counts derive from squad size ([D22](../spec/00-decisions.md)); response cards ([D42](../spec/00-decisions.md)) readable at 375px with no horizontal scroll; the three-state segmented control is thumb-tappable and the setting survives a reload |
| 14  | Safe areas: nav clears the home indicator; YES / NO not under the nav              | both    | AC13     | Fixed bottom nav padded by `env(safe-area-inset-bottom)`; on `/#/event/:id` the nav is hidden so the YES/NO buttons are never under it ([D41](../spec/00-decisions.md))                                                                            |
| 15  | Aeroplane mode: shell loads; response attempt shows the failure line               | both    | AC14     | Relaunch loads the cached shell, not a browser error page; a response attempt shows "Couldn't save. Tap again." ([D48](../spec/00-decisions.md)), not a crash or silent no-op                                                                      |
| 16  | After the next deploy: relaunch twice; release string changed                      | both    | AC15     | The `pfc-release` string is the new build's after two relaunches ([D43](../spec/00-decisions.md)) — the stale shell breaks every WhatsApp link at once, so this is the one that matters                                                            |
| 17  | Relaunch ≥24h later: no login, no login flash                                      | both    | AC8      | Session restored silently, no password typed, no flash of login ([S2.6](../spec/stories/S2.6-session-persistence.md), [D59](../spec/00-decisions.md)). **Record the two launch timestamps**, do not assert from memory                             |
| 18  | Timing: three fresh runs on **mobile data**; record each; p50 < 60s                | Android | AC12     | From tapping the WhatsApp link to the YES confirmation on screen, as a brand new user each run. Fresh reserved number each run, Chrome data cleared between runs ([D21](../spec/00-decisions.md), [D58](../spec/00-decisions.md))                  |
| 19  | Join link pasted into WhatsApp arrives whole with fragment; taps to join screen    | both    | AC17     | The [S6.2](../spec/stories/S6.2-team-join-links.md) join link survives paste with everything after `#` intact ([D52](../spec/00-decisions.md)); tapping it on the other device reaches the join screen                                             |
| 20  | Send one reminder from a real phone; differs from initial share; names nobody      | both    | AC17     | The [S5.3](../spec/stories/S5.3-reminder-share.md) reminder text reads differently from the initial share and names no player                                                                                                                      |

### Timing table (step 18 / AC12)

If the p50 comes in over 60s it is a **finding, not a release blocker on its own** (open question 1): record
the number, name the slowest step from the run notes, and raise it against the story that owns that step.

| Run     | Fresh number | Start (tap link) | End (YES on screen) | Seconds | Network     |
| ------- | ------------ | ---------------- | ------------------- | ------- | ----------- |
| 1       |              |                  |                     |         | mobile data |
| 2       |              |                  |                     |         | mobile data |
| 3       |              |                  |                     |         | mobile data |
| **p50** |              |                  |                     |         |             |

---

## Pass sections

Copy the block below for each device and each re-run. Fill the header, then a `pass`/`fail` and a note per
step. Screenshot the received WhatsApp message (step 3) and commit it beside this file.

### YYYY-MM-DD — iPhone MODEL, iOS X.X, Safari X.X — release _______ — tester: NAME

Not yet run. Reviewer to complete on hardware.

| #   | Step                                                                  | Result        | Note              |
| --- | --------------------------------------------------------------------- | ------------- | ----------------- |
| 1   | Manager creates a match from the phone                                |               |                   |
| 2   | Share: native sheet opens, WhatsApp offered                           |               |                   |
| 3   | Message arrives, format correct, link tappable (screenshot committed) |               |                   |
| 4   | Cold preview: team, title, date, location, Join button, no notes      |               |                   |
| 5   | Register; land on the exact event                                     |               |                   |
| 6   | Tap YES; confirmation visible                                         |               |                   |
| 7   | Escape prompt (iOS webview); install guide never both                 |               |                   |
| 8   | Copy link, open in Safari, sign in once more, install guide appears   |               |                   |
| 9   | Add to Home Screen; icon is the 180x180 asset                         |               |                   |
| 10  | Launch from home screen: standalone, no prompts                       |               |                   |
| 11  | Force-quit, relaunch: response still shows YES                        |               |                   |
| 12  | Second event link while installed; surface recorded                   |               |                   |
| 13  | Manager view / record attendance                                      | n/a — Android | n/a per checklist |
| 14  | Safe areas: nav clears indicator; YES/NO not under nav                |               |                   |
| 15  | Aeroplane mode: shell loads; failure line shown                       |               |                   |
| 16  | After next deploy: relaunch twice; release string changed             |               |                   |
| 17  | Relaunch ≥24h later: no login, no flash (timestamps: ___ / ___)       |               |                   |
| 18  | Timing three runs / p50 < 60s                                         | n/a — Android | n/a per checklist |
| 19  | Join link pastes whole into WhatsApp; taps to join screen             |               |                   |
| 20  | Reminder differs from initial share; names nobody                     |               |                   |

### YYYY-MM-DD — Android MODEL, Android X, Chrome X — release _______ — tester: NAME

Not yet run. Reviewer to complete on hardware. Record the exact model (mid-range only).

| #   | Step                                                                                               | Result       | Note              |
| --- | -------------------------------------------------------------------------------------------------- | ------------ | ----------------- |
| 1   | Manager creates a match from the phone                                                             |              |                   |
| 2   | Share: native sheet opens, WhatsApp offered                                                        |              |                   |
| 3   | Message arrives, format correct, link tappable (screenshot committed)                              |              |                   |
| 4   | Cold preview: team, title, date, location, Join button, no notes                                   |              |                   |
| 5   | Register; land on the exact event                                                                  |              |                   |
| 6   | Tap YES; confirmation visible                                                                      |              |                   |
| 7   | Install guide (Android Chrome) or written fallback; branch recorded                                |              |                   |
| 8   | Copy link, open in Safari, sign in once more, install guide appears                                | n/a — iPhone | n/a per checklist |
| 9   | Add to Home Screen; icon is the 180x180 asset                                                      |              |                   |
| 10  | Launch from home screen: standalone, no prompts                                                    |              |                   |
| 11  | Force-quit, relaunch: response still shows YES                                                     |              |                   |
| 12  | Second event link while installed; surface recorded                                                |              |                   |
| 13  | Manager view: counts correct; cards readable at 375px; segmented control tappable; survives reload |              |                   |
| 14  | Safe areas: nav clears indicator; YES/NO not under nav                                             |              |                   |
| 15  | Aeroplane mode: shell loads; failure line shown                                                    |              |                   |
| 16  | After next deploy: relaunch twice; release string changed                                          |              |                   |
| 17  | Relaunch ≥24h later: no login, no flash (timestamps: ___ / ___)                                    |              |                   |
| 18  | Timing three runs on mobile data; p50 < 60s (see timing table)                                     |              |                   |
| 19  | Join link pastes whole into WhatsApp; taps to join screen                                          |              |                   |
| 20  | Reminder differs from initial share; names nobody                                                  |              |                   |

---

## Acceptance criteria coverage

Where each story acceptance criterion is proved in the checklist above:

| AC                                                                                  | Proved by                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------ |
| AC1 — file committed, one section per device, every field and step filled           | This document, filled per pass             |
| AC2 — full journey from a real WhatsApp message, response persists after force-quit | Steps 3–6, 11                              |
| AC3 — cold preview shows team/title/date/location/one Join button, no notes         | Step 4                                     |
| AC4 — iOS webview escape prompt, copy states second sign-in, pastes to sign-in      | Steps 7, 8                                 |
| AC5 — iOS install guide, real share icon, 180x180 installed icon                    | Steps 8, 9                                 |
| AC6 — Android install button or written fallback; branch recorded                   | Steps 7, 9                                 |
| AC7 — standalone launch, no chrome, no prompts                                      | Step 10                                    |
| AC8 — ≥24h relaunch: session restored, no flash, timestamp pair recorded            | Step 17                                    |
| AC9 — second event link while installed; surface recorded                           | Step 12                                    |
| AC10 — share sheet, WhatsApp offered, message format intact, screenshot committed   | Steps 2, 3                                 |
| AC11 — Android attendance at 375px, segmented control, survives reload              | Step 13                                    |
| AC12 — timing p50 < 60s over three mobile-data runs                                 | Step 18 + timing table                     |
| AC13 — safe areas; YES/NO not under nav                                             | Step 14                                    |
| AC14 — aeroplane mode: cached shell + failure line                                  | Step 15                                    |
| AC15 — release string changes after deploy                                          | Step 16                                    |
| AC16 — **automated**: `index.html` iOS tags                                         | `src/test/index-html.test.ts` (runs in CI) |
| AC17 — join link fragment intact; reminder differs and names nobody                 | Steps 19, 20                               |
| AC18 — every failed step names its owning story; re-run after fix                   | Fail notes + re-run sections               |
