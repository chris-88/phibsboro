# State coverage audit (S7.1)

Every route handles four states — loading, empty, error, populated — or names why a state does not
apply. One row per route in [D34](../spec/00-decisions.md), plus the two conditional surfaces
([S2.7](../spec/stories/S2.7-escape-the-whatsapp-browser.md) escape prompt,
[S2.8](../spec/stories/S2.8-add-to-home-screen-guide.md) install guide). No cell is blank: each
names the test that keeps it true, or the literal `n/a — <reason>`.

The route column is generated from `src/test/route-manifest.ts`; `src/test/state-coverage-doc.test.ts`
fails if the two ever drift, so this document cannot rot. The four-state assertions live in
`src/test/states.test.tsx`, which mounts every route through the real route table and the real
`src/api/` hooks against a stubbed Supabase client (`src/test/supabase-stub.ts`), one row per
state; a route missing a state fails the test rather than the review.

## Coverage

| Route                          | Loading                                            | Empty                                                     | Error                                                         | Populated                                            |
| ------------------------------ | -------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------- |
| `/`                            | states.test.tsx › / (home) › loading               | states.test.tsx › / (home) › empty                        | states.test.tsx › / (home) › error (Retry refetches)          | states.test.tsx › / (home) › populated               |
| `/login`                       | states.test.tsx › /login › loading (no form flash) | n/a — form, no server read                                | login-screen.test.tsx › wrong password keeps the number       | states.test.tsx › /login › populated                 |
| `/register`                    | states.test.tsx › /register › loading              | n/a — arrival is always token-scoped                      | states.test.tsx › /register › error (Retry refetches)         | states.test.tsx › /register › populated              |
| `/join/:token`                 | states.test.tsx › /join › loading                  | n/a — zero rows is the InviteInvalid dead-link state      | states.test.tsx › /join › error (Retry refetches)             | states.test.tsx › /join › populated                  |
| `/reset/:token`                | ResetPasswordScreen.test.tsx › submit spinner      | n/a — form                                                | ResetPasswordScreen.test.tsx › invalid token → LinkProblem    | states.test.tsx › /reset › populated                 |
| `/event/:id`                   | states.test.tsx › /event/:id › loading             | n/a — unknown id renders the 404 screen                   | states.test.tsx › /event/:id › error (Retry refetches)        | states.test.tsx › /event/:id › populated             |
| `/history`                     | states.test.tsx › /history › loading               | states.test.tsx › /history › empty                        | states.test.tsx › /history › error (Retry refetches)          | states.test.tsx › /history › populated               |
| `/manage`                      | states.test.tsx › /manage › loading                | states.test.tsx › /manage › empty                         | states.test.tsx › /manage › error (Retry refetches)           | states.test.tsx › /manage › populated                |
| `/manage/event/new`            | states.test.tsx › /manage/event/new › loading      | n/a — form                                                | states.test.tsx › /manage/event/new › error (Retry refetches) | states.test.tsx › /manage/event/new › populated      |
| `/manage/event/:id`            | states.test.tsx › /manage/event/:id › loading      | states.test.tsx › /manage/event/:id › empty (empty squad) | states.test.tsx › /manage/event/:id › error (Retry refetches) | states.test.tsx › /manage/event/:id › populated      |
| `/manage/team/:teamId/members` | states.test.tsx › members › loading                | states.test.tsx › members › empty                         | states.test.tsx › members › error (Retry refetches)           | states.test.tsx › members › populated                |
| `/admin`                       | states.test.tsx › /admin › loading                 | states.test.tsx › /admin › empty                          | states.test.tsx › /admin › error (Retry refetches)            | states.test.tsx › /admin › populated                 |
| 404                            | n/a — static                                       | n/a — static                                              | n/a — static                                                  | states.test.tsx › 404 › populated                    |
| Escape prompt (S2.7)           | n/a                                                | n/a                                                       | n/a                                                           | escape-prompt.test.tsx › renders after a response    |
| Install guide (S2.8)           | n/a                                                | n/a                                                       | n/a                                                           | install-guide-card.test.tsx / install-sheet.test.tsx |

Notes on the `n/a` cells:

- **Form loading** (`/login`, `/reset/:token`) is a spinner inside the submit button, not a
  page skeleton; it is a form-submit state, proved in each screen's own story test rather than
  re-driven in the states harness.
- **Form/token error** (`/login` wrong password, `/register` dead link, `/reset/:token` invalid
  token) is a submit failure, not a query error with a Retry, so its cell names each screen's own
  story test. The server-read error states (every other Error cell above) are driven in
  `states.test.tsx`, which asserts the inline line, the Retry control, and a second request on
  click ([AC3](../spec/stories/S7.1-state-coverage-audit.md)).
- **`/event/:id` empty** and **`/join/:token` empty** are not empty states: an unknown event id
  renders the 404 screen, and a zero-row invite lookup renders the `InviteInvalid` dead-link
  screen. Both are exercised by the harness's error/populated rows and their own story tests.

## Gaps

None. The sweep found every route already handling its four states — the outcome
[D49](../spec/00-decisions.md) and [D57](../spec/00-decisions.md) were written to produce: each
screen's own story fixed its empty and error copy, so S7.1 is a check, not a rework. No screen
falls through to the S0.6 error boundary as its designed error state, and no route renders an empty
document body (asserted for every row by `states.test.tsx`).

Three cross-cutting items this story owns, closed in this story's commit:

| Item                     | What was added                                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The audit artifact       | `docs/state-coverage.md` (this file) and `src/test/state-coverage-doc.test.ts`, which pins the route list to `src/test/route-manifest.ts`.                                                                               |
| No unhandled rejections  | `src/test/setup.ts` throws on `unhandledRejection` (Vitest, AC6); `tests/e2e/fixtures.ts` fails any spec that emits a `pageerror` or `console.error` (Playwright, AC7).                                                  |
| Type-aware promise rules | `eslint.config.js` restates `@typescript-eslint/no-floating-promises` and `no-misused-promises` (with `checksVoidReturn.attributes: false`) as errors; the tree is clean, `void` marks every real fire-and-forget (AC5). |

## Confirmations

- **AC11** — the [D35](../spec/00-decisions.md) lint ban on `toLocaleString`, `toLocaleDateString`,
  `toLocaleTimeString` and `new Intl.DateTimeFormat` outside `src/lib/time.ts` is live in
  `eslint.config.js` (`DATE_RULES`) and clean across the tree; `npm run lint` exits 0 with no
  correction needed. A weakened rule would show as a lint failure here.
- **AC9** — `tests/e2e/layout.spec.ts` sweeps every route at 375×667 for horizontal scroll and a
  44px interactive-element floor. It runs under the gated Playwright job (see below).

## Deferred

The Playwright legs (`tests/e2e/layout.spec.ts`, AC9; the `failOnPageError` auto-fixture, AC7) are
written and wired but do not run in CI yet: the local-stack Playwright jobs are gated behind
`RUN_LOCAL_STACK` and currently skip (a CLI local-stack 403). Their live run is deferred to when
that gate is enabled. The unit-level parts (AC1–AC6, AC8, AC10, AC11) run in `npm run test` and are
verified here.
