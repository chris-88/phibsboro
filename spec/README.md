# Phibsboro FC — specification

This directory is the build plan. [`../CLAUDE.md`](../CLAUDE.md) is the product statement; everything here
expands it into stories an engineer can pick up one at a time. One story per PR. Build in the order
below, not in epic order: the epics are documentation groupings, the numbered sequence is the build order
of record (D20). A story is not started until every story it depends on is Done. Where a story spec
disagrees with `CLAUDE.md`, [`00-decisions.md`](00-decisions.md) says which wins and why; where either
disagrees with the schema, [`data-model.md`](data-model.md) wins.

**The journey:** create event → share to WhatsApp → player taps link → Yes/No → manager sees counts →
manager records attendance.

## Build order

43 stories. Two are gates. **[S1.2](stories/S1.2-profile-provisioning-and-seed.md)** proves phone auth on a
real project (D19); no Epic 2 work starts until its outcome is recorded. **[S1.4](stories/S1.4-rls-test-suite.md)**
is the security gate (D55); no feature UI that reads or writes team data ships before it passes. The Epic 0
shell, routing and PWA are exempt because they touch no data.

| # | ID | Story | Epic | Depends on | Size | Status |
|---|---|---|---|---|---|---|
| 1 | [S0.1](stories/S0.1-project-scaffold.md) | Project scaffold | 0 Foundation | — | M | **Done** |
| 2 | [S0.2](stories/S0.2-ui-system.md) | UI system | 0 Foundation | S0.1 | M | **Done** |
| 3 | [S0.7](stories/S0.7-ci-pipeline.md) | CI pipeline | 0 Foundation | S0.1 | S | **Done** |
| 4 | [S0.5](stories/S0.5-deployment.md) | Deployment | 0 Foundation | S0.1, S0.7 | M | **Done** |
| 5 | [S0.3](stories/S0.3-routing.md) | Routing | 0 Foundation | S0.1, S0.2, S0.5, S0.7 | M | **Done** |
| 6 | [S0.4](stories/S0.4-pwa.md) | PWA | 0 Foundation | S0.1, S0.2, S0.3, S0.5, S0.7 | M | **Done** |
| 7 | [S0.6](stories/S0.6-observability.md) | Observability | 0 Foundation | S0.1, S0.2, S0.3, S0.5 | S | **Done** |
| 8 | [S1.1](stories/S1.1-schema.md) | Schema | 1 Database and security | S0.1, S0.5, S0.7 | M | **Done** |
| 9 | [S1.2](stories/S1.2-profile-provisioning-and-seed.md) | Profile provisioning and seed — **gate: phone auth (D19)** | 1 Database and security | S1.1, S0.7 | L | **Done** |
| 10 | [S1.3](stories/S1.3-rls-policies-and-rpcs.md) | RLS policies and RPCs | 1 Database and security | S1.1, S1.2 | L | **Done** |
| 11 | [S1.4](stories/S1.4-rls-test-suite.md) | RLS test suite — **blocking gate** | 1 Database and security | S0.7, S1.1, S1.2, S1.3 | L | **Done** |
| 12 | [S1.5](stories/S1.5-typed-data-layer-and-shared-helpers.md) | Typed data layer and shared helpers | 1 Database and security | S0.1, S0.7, S1.1, S1.3, S1.4 | M | **Done** |
| 13 | [S6.1](stories/S6.1-teams.md) | Teams | 6 Admin | S0.2, S0.3, S1.1, S1.3, S1.4, S1.5 | M | **Done** |
| 14 | [S6.2](stories/S6.2-team-join-links.md) | Team join links | 6 Admin | S0.2, S0.3, S1.3, S1.4, S1.5, S6.1 | M | **Done** |
| 15 | [S2.9](stories/S2.9-auth-guard-and-role-context.md) | Auth guard and role context | 2 Auth and install | S0.2, S0.3, S0.6, S1.4, S1.5 | M | **Done** |
| 16 | [S2.1](stories/S2.1-registration.md) | Registration | 2 Auth and install | S0.2, S0.3, S1.2, S1.3, S1.4, S1.5, S2.9, S6.2 | M | **Done** |
| 17 | [S2.2](stories/S2.2-sign-in.md) | Sign in | 2 Auth and install | S0.2, S0.3, S1.2, S1.4, S1.5, S2.1, S2.9 | S | Not started |
| 18 | [S2.6](stories/S2.6-session-persistence.md) | Session persistence | 2 Auth and install | S0.1, S0.4, S0.7, S1.5, S2.2, S2.9 | M | Not started |
| 19 | [S3.3](stories/S3.3-event-detail-screen.md) | Event detail screen | 3 Player | S0.2, S0.3, S1.3, S1.4, S1.5, S2.1, S2.6, S2.9 | L | Not started |
| 20 | [S2.4](stories/S2.4-join-by-link.md) | Join by link | 2 Auth and install | S0.3, S1.3, S1.4, S1.5, S2.1, S2.2, S2.6, S2.9, S3.3, S6.2 | M | Not started |
| 21 | [S2.5](stories/S2.5-deep-link-return-path.md) | Deep link return path | 2 Auth and install | S0.3, S0.5, S0.7, S2.1, S2.2, S2.4, S2.6, S2.9, S3.3 | M | Not started |
| 22 | [S6.4](stories/S6.4-member-administration.md) | Member administration | 6 Admin | S1.3, S1.4, S1.5, S2.1, S2.4, S2.9, S6.1, S6.2 | L | Not started |
| 23 | [S2.3](stories/S2.3-password-reset-by-manager.md) | Password reset by manager | 2 Auth and install | S0.3, S1.3, S1.4, S1.5, S2.1, S2.2, S2.9, S6.4 | M | Not started |
| 24 | [S3.4](stories/S3.4-changing-a-response.md) | Changing a response | 3 Player | S1.3, S1.4, S1.5, S2.9, S3.3 | S | Not started |
| 25 | [S3.1](stories/S3.1-home-screen-with-next-event.md) | Home screen with next event | 3 Player | S0.2, S0.3, S1.4, S1.5, S2.9, S3.3, S3.4 | M | Not started |
| 26 | [S3.2](stories/S3.2-upcoming-events-list.md) | Upcoming events list | 3 Player | S0.2, S1.4, S1.5, S2.9, S3.1, S3.3 | S | Not started |
| 27 | [S2.7](stories/S2.7-escape-the-whatsapp-browser.md) | Escape the WhatsApp browser | 2 Auth and install | S0.2, S0.4, S2.9, S3.1, S3.3 | M | Not started |
| 28 | [S2.8](stories/S2.8-add-to-home-screen-guide.md) | Add to home screen guide | 2 Auth and install | S0.2, S0.4, S2.7, S2.9, S3.1, S3.3 | M | Not started |
| 29 | [S4.1](stories/S4.1-create-event.md) | Create event | 4 Manager | S0.2, S0.3, S1.3, S1.4, S1.5, S2.9, S3.3, S6.1 | M | Not started |
| 30 | [S4.2](stories/S4.2-edit-and-cancel-event.md) | Edit and cancel event | 4 Manager | S1.3, S1.4, S1.5, S2.9, S3.3, S4.1 | M | Not started |
| 31 | [S4.3](stories/S4.3-manager-event-view.md) | Manager event view | 4 Manager | S1.3, S1.4, S1.5, S2.9, S3.3, S4.1, S4.2, S6.2, S6.4 | M | Not started |
| 32 | [S4.4](stories/S4.4-player-response-list.md) | Player response list | 4 Manager | S1.3, S1.4, S1.5, S2.9, S3.2, S4.3 | M | Not started |
| 33 | [S4.5](stories/S4.5-record-attendance.md) | Record attendance | 4 Manager | S1.3, S1.4, S1.5, S4.3, S4.4 | M | Not started |
| 34 | [S3.5](stories/S3.5-own-attendance-history.md) | Own attendance history | 3 Player | S0.2, S0.3, S1.4, S1.5, S2.9, S3.3, S3.4, S4.5 | M | Not started |
| 35 | [S5.1](stories/S5.1-message-generator.md) | Message generator | 5 Sharing | S0.1, S0.3, S1.5 | S | Not started |
| 36 | [S5.2](stories/S5.2-share-action.md) | Share action | 5 Sharing | S0.2, S2.9, S4.3, S5.1, S6.2 | S | Not started |
| 37 | [S5.3](stories/S5.3-reminder-share.md) | Reminder share | 5 Sharing | S4.3, S5.1, S5.2 | S | Not started |
| 38 | [S4.6](stories/S4.6-recurring-training.md) | Recurring training | 4 Manager | S1.1, S1.3, S1.4, S1.5, S4.1, S4.2 | M | Not started |
| 39 | [S6.3](stories/S6.3-all-teams-view.md) | All-teams view | 6 Admin | S1.4, S2.9, S4.1–S4.6, S6.1, S6.2, S6.4 | M | Not started |
| 40 | [S7.1](stories/S7.1-state-coverage-audit.md) | State coverage audit | 7 Quality gate | S0.6, S0.7, S1.5, and every story that adds a screen | M | Not started |
| 41 | [S7.2](stories/S7.2-unit-tests.md) | Unit tests | 7 Quality gate | S0.6, S0.7, S1.5, S2.6, S4.3, S4.6, S5.1, S5.2, S5.3 | M | Not started |
| 42 | [S7.3](stories/S7.3-end-to-end-journey.md) | End-to-end journey | 7 Quality gate | S0.4, S0.7, S1.2, S2.1, S2.2, S2.4–S2.8, S3.3, S4.1, S4.3, S4.4, S4.5, S5.1, S5.2, S7.1 | L | Not started |
| 43 | [S7.4](stories/S7.4-device-pass.md) | Device pass | 7 Quality gate | S0.4, S0.5, S2.1, S2.4–S2.8, S3.3, S4.1, S4.3, S4.5, S5.2, S5.3, S6.1, S6.2, S7.1, S7.3 | S | Not started |

Each story file carries the full dependency list in its header. The abbreviated ranges above are a
reading aid, not the record.

## Epics

- **Epic 0 — Foundation** (S0.1–S0.7): a deployed, installable, instrumented shell with CI. Nothing a
  player can use yet.
- **Epic 1 — Database and security** (S1.1–S1.5): eight tables, the profile trigger and seed, RLS and
  RPCs, the test suite that proves them, and the typed data layer every screen reads through.
- **Epic 2 — Auth, self-registration and install** (S2.1–S2.9): a player gets from a WhatsApp link to a
  signed-in session on the right event, and off the WhatsApp webview onto the home screen.
- **Epic 3 — Player experience** (S3.1–S3.5): the next event, the list below it, the deep-link target,
  changing an answer, and an attendance history.
- **Epic 4 — Manager experience** (S4.1–S4.6): create, edit and cancel events, see the counts and the
  responses, record attendance, generate a term of training.
- **Epic 5 — WhatsApp sharing** (S5.1–S5.3): the message text, the share action, and the reminder
  variant. The app never sends anything itself.
- **Epic 6 — Admin** (S6.1–S6.4): teams, join links, member administration, and an admin view across
  every team.
- **Epic 7 — Quality gate** (S7.1–S7.4): the four-states audit, the unit tests, the end-to-end journey,
  and a manual pass on a real iPhone and a real Android.

## Documents

- [`00-decisions.md`](00-decisions.md) — the decision record. Settles every place `CLAUDE.md` contradicts
  itself or leaves a rule unstated. It wins over the brief; each story cites the decisions it depends on.
- [`data-model.md`](data-model.md) — the settled schema. Eight tables, four enums, every FK and
  `on delete` rule. It wins over both the brief and the decision record on anything schema-shaped.
- [`_template.md`](_template.md) — the story template. Copy it for any new story so the header table,
  acceptance criteria, UI states and test plan stay in the same shape.

## Definition of done

A story is done when: acceptance criteria are met, `typecheck` and `lint` are clean, tests for that story
pass in CI, the four UI states are handled, and RLS still passes S1.4.

Three exemptions, each written into the relevant story rather than left to inference (D56): the S1.4 gate
applies from S1.4 onward, the four-states gate applies only to stories that add or change a screen, and
S7.4 is signed off by committing `docs/device-pass.md` and pasting it into the PR.

## Status legend

**Not started** — nobody has opened a branch. **In progress** — branch open, story not finished.
**In review** — PR open, CI green, waiting on review. **Done** — merged to `main` with every box in its
Definition of done ticked. Update the status here and in the story's own header table in the same PR.
