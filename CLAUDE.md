# CLAUDE.md — Phibsboro FC Attendance PWA

## 1. What this is

A mobile-first PWA for Phibsboro FC. Managers create training sessions and matches, share them into existing WhatsApp groups, and collect availability and attendance.

The only journey that matters:

**Create event → Share to WhatsApp → Player taps link → Yes/No → Manager sees counts → Manager records attendance**

Keep it boring. If a feature does not materially improve that journey, do not build it. Do not add scope beyond the story you are working on. If a story seems to require something not listed, stop and flag it rather than inventing it.

## 2. Stack

| Concern      | Choice                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------- |
| Build        | Vite + React + TypeScript (strict, `noUncheckedIndexedAccess`, no `any`)                  |
| UI           | shadcn/ui + Tailwind. Mandatory default. Do not hand-roll components that shadcn provides |
| Routing      | React Router with **HashRouter** (required for GitHub Pages deep links)                   |
| Server state | TanStack Query. All Supabase reads/writes go through query/mutation hooks in `src/api/`   |
| Client state | Zustand, UI state only. Never cache server data here                                      |
| Validation   | Zod. One schema per entity, shared between forms and API boundaries                       |
| Forms        | React Hook Form + zodResolver                                                             |
| Backend      | Supabase: Auth, Postgres, RLS                                                             |
| Hosting      | GitHub Pages, deployed by GitHub Actions, custom domain `app.phibsborofc.com`             |
| Errors       | Sentry                                                                                    |
| Tests        | Vitest (unit), Playwright (E2E)                                                           |

## 3. Conventions

- Structure by feature: `src/features/{events,availability,attendance,teams,auth}/`, shared code in `src/components/`, `src/lib/`, `src/api/`.
- Supabase types are generated (`supabase gen types typescript`) into `src/lib/database.types.ts`. Never hand-write row types.
- All timestamps stored as `timestamptz` in UTC. All display formatting through a single `formatEventTime()` helper pinned to `Europe/Dublin`. No ad-hoc `toLocaleString` calls.
- Every screen must handle four states: loading, empty, error, populated. A story is not done if any are missing.
- Touch targets minimum 44px. Primary actions reachable with one thumb.
- No secrets in the repo. Supabase URL and anon key via Vite env vars, injected in CI.
- Conventional commits. One story per PR.

## 4. Roles

- **Player**: sees own team's events, sets own availability, sees own attendance.
- **Manager**: everything a player can, plus create/edit/cancel events, view responses, record attendance, share to WhatsApp. Scoped to teams they manage.
- **Admin**: creates teams, manages users and memberships, administers all teams.

A user may belong to more than one team, potentially with different roles.

## 5. Data model

Starting point. Refine it if needed, but flag the change first.

```
profiles        id, name, phone (E.164, unique)
teams           id, name, active
team_invites    id, team_id, token (unguessable), role, active, expires_at, created_by
reset_tokens    id, user_id, token (unguessable), used_at, expires_at, created_by
team_members    team_id, user_id, role ('player'|'manager'|'admin')
events          id, team_id, type ('training'|'match'), title, location,
                notes, starts_at, status ('scheduled'|'cancelled'), created_by
event_responses event_id, user_id, response ('available'|'unavailable'), updated_at
attendance      event_id, user_id, attended (bool), recorded_by, updated_at
```

`event_responses` and `attendance` are keyed on `(event_id, user_id)`. Absence of a row in `event_responses` means "awaiting response". Do not store "awaiting" as a value.

Phone numbers are stored in E.164 only. Normalise on input, defaulting to `+353` for Irish numbers entered as `08...`. Never store the raw typed string.

---

# Stories

Build in order. Each story lists acceptance criteria. Do not start a story until the ones it depends on pass.

## Epic 0 — Foundation

### S0.1 Project scaffold

Vite + React + TS project, strict compiler options, ESLint + Prettier, path alias `@/`.

- `npm run dev`, `build`, `lint`, `typecheck` all pass on a clean checkout.
- No TypeScript errors, no `any`.

### S0.2 UI system

Tailwind + shadcn/ui installed. App shell with mobile-first layout, bottom nav or header appropriate to role.

- Renders correctly at 375px width.
- Theme tokens defined once, no hardcoded hex values in components.

### S0.3 Routing

HashRouter with routes: `/`, `/login`, `/event/:id`, `/manage`, `/manage/event/:id`, `/manage/event/new`, `/admin`.

- Deep link `/#/event/abc123` resolves after a hard refresh on GitHub Pages.
- Unknown routes render a 404 screen with a link home.

### S0.4 PWA

Manifest, icons, service worker, installable on iOS and Android.

- Passes Lighthouse installability checks.
- Launching from home screen opens in standalone mode.
- Service worker does not serve stale app shell after a deploy.

### S0.5 Deployment

GitHub Actions workflow building and publishing to Pages on merge to `main`. CNAME for `app.phibsborofc.com`.

- Push to main results in a live updated site.
- Env vars injected from repo secrets.

### S0.6 Observability

Sentry initialised with release tagging and an error boundary at the app root.

- A thrown test error appears in Sentry with a readable stack trace.

## Epic 1 — Database and security

### S1.1 Schema

Migration creating all six tables with FKs, unique constraints on `(event_id, user_id)`, and indexes on `events(team_id, starts_at)` and `team_members(user_id)`.

- Migration runs clean on an empty database.
- Seed script creates one club, two teams, an admin, two managers, twenty players.

### S1.2 Profile provisioning

Trigger creating a `profiles` row on `auth.users` insert, taking name from signup metadata and phone from the auth record.

- New signup automatically has a profile with name and phone populated.
- Phone is unique across `auth.users`. A second signup with the same number is rejected cleanly rather than creating a duplicate profile.
- Phone confirmation is off in Auth config. Numbers are unverified by design, so nothing in the app may treat a number as proof of identity.

### S1.3 RLS policies

RLS enabled on every table. SQL helper functions `is_team_member(team_id)`, `is_team_manager(team_id)`, `is_admin()`.

- Player can read events only for teams they belong to.
- Player can insert/update only their own `event_responses` row.
- Player cannot write `attendance` at all.
- Manager can CRUD events, read all responses, and write attendance only for teams they manage.
- Admin can administer everything.
- `team_invites` are readable only by token lookup through a security-definer RPC. The table itself is not selectable by clients, so nobody can enumerate invite tokens.
- Joining a team happens through a security-definer RPC that validates the token, checks `active` and `expires_at`, and inserts the `team_members` row. Clients cannot insert into `team_members` directly.
- `reset_tokens` is not selectable by clients. Issuing and redeeming both go through security-definer RPCs. Redeeming marks `used_at` and is single use.
- Direct PostgREST calls with another team's ID return no rows, not an error page.

### S1.4 RLS test suite

**Blocking story. Do not proceed to UI without it.** Integration tests hitting Supabase as each role, asserting both permitted and denied paths.

- Every policy in S1.3 has a passing test and a matching negative test.
- Runs in CI.

### S1.5 Typed data layer

Generated database types, Zod schemas per entity, typed Supabase client, TanStack Query hooks.

- Every table has a Zod schema and inferred TS type used by both forms and API responses.

## Epic 2 — Auth, self-registration and install

Auth is mobile number plus password. **Phone confirmation is disabled in Supabase Auth config, so no SMS is ever sent and there is no OTP step.** Trust comes from the join link instead: only people in the squad WhatsApp group have it. Registration is three fields and one button. This is the highest-risk part of the build for drop-off, so keep it that short.

### S2.1 Registration

Reachable only with a valid invite token. A bare visit to `/#/register` without a token is rejected.

- Fields: name, mobile number, password. Nothing else.
- Number defaults to Ireland, accepts `087...` and `+3538...`, normalises to E.164 before submit.
- Password minimum 8 characters, strength hint only, no composition rules.
- Duplicate number returns "that number is already registered" with a link to sign in, not a raw Postgres unique-violation error.
- On success the user is signed in immediately and joined to the invite's team. No confirmation step.

### S2.2 Sign in

Mobile number and password, one screen.

- Same E.164 normalisation as registration, so a player who typed `+353 87` at signup can sign in with `087`.
- Wrong password shows an inline error and keeps the number.
- "Forgot password" does not self-serve. It shows a line telling the player to ask their manager for a reset link, since we cannot verify them without SMS or email.
- Rate limit failed attempts per number.

### S2.3 Password reset by manager

Managers and admins issue a one-time reset link for a member of their team, copied and sent over WhatsApp.

- Reuses the invite token mechanism, scoped to a single user, single use, expiring in 24 hours.
- Reset link opens a set-password screen and signs the user in on success.
- Issuing a new link invalidates any previous one for that user.
- Managers can only reset players on teams they manage. Enforced in the RPC, not the UI.

### S2.4 Join by link

Two entry points create a team membership.

- `/#/join/{token}` shows the team name, then registration or sign-in, then joins that team as the invite's role.
- `/#/event/{id}` from an unknown user does the same, joining the team that owns the event, as a player.
- An already-signed-in user tapping a join link is joined without re-authenticating.
- Joining is idempotent. Tapping a join link twice does not duplicate membership.
- Expired, revoked or unknown tokens show a plain "ask your manager for a new link" screen, never a stack trace.

### S2.5 Deep link return path

**Critical UX requirement.** A tap on `/#/event/abc123` by a brand new user must land on that exact event after registering.

- Intended route captured before any redirect, survives registration and any cold start.
- Works from the WhatsApp in-app browser, mobile Safari, mobile Chrome, and the installed PWA.
- The whole path from tapping the WhatsApp link to submitting a Yes is under 60 seconds for a new user.
- Covered by a Playwright test.

### S2.2 Deep link return path

**Critical UX requirement.** An unauthenticated tap on `/#/event/abc123` must return the player to that exact event after sign-in.

- Intended route captured before redirect to login.
- Restored after successful auth, including when auth redirects through an external callback.
- Works cold-start from the WhatsApp in-app browser and from the installed PWA.
- Covered by a Playwright test.

### S2.6 Session persistence

Session restored on relaunch. Silent refresh of expired tokens.

- Reopening the app after 24 hours does not force a re-login.
- No flash of the login screen while the session is being restored.
- Sessions are long lived. A player should not need to re-enter a password for a full season, because password recovery costs a manager a manual step. Re-authentication only when the refresh token genuinely expires.

### S2.7 Escape the WhatsApp browser

WhatsApp opens links in an in-app webview that cannot install a PWA and does not share Safari or Chrome's session. This is the single biggest cause of failed installs, so handle it explicitly.

- Detect the in-app browser via user agent and standalone checks.
- When detected, after the player has responded, show a one-line prompt to open in Safari or Chrome, with a copy-link button as fallback.
- Never block the availability response behind this. Respond first, prompt second.

### S2.8 Add to home screen guide

Shown once after a player's first successful response, and available any time from a menu item.

- Platform detected, and only the relevant instructions shown.
- **iOS Safari**: tap Share, scroll to Add to Home Screen, tap Add. Illustrated with the actual iOS share icon, not a description of it.
- **Android Chrome**: capture `beforeinstallprompt` and show a real Install button. If the event is unavailable, fall back to written steps: tap the three dot menu, then Install app or Add to Home screen.
- Suppressed entirely when `display-mode: standalone` matches, so installed users never see it.
- Dismissable, and the dismissal is remembered.
- Copy is written for a footballer holding a phone in a car park. Short sentences, no jargon, no "PWA".

### S2.9 Auth guard and role context

Route guards plus a `useCurrentUser()` hook exposing profile, memberships and per-team role.

- Player navigating to `/manage` is redirected, not shown a broken screen.
- Role checks in UI are convenience only. RLS remains the enforcement layer.

## Epic 3 — Player experience

### S3.1 Home screen with next event

Prominent next-event card: type badge, title, day and time, location, and large YES / NO buttons.

- Response registers in one tap and updates optimistically.
- Current response is visually obvious on return.
- Empty state when no upcoming events.

### S3.2 Upcoming events list

Below the next-event card: chronological list showing time, type, and the player's own status.

- Shows Available, Unavailable, or Awaiting for each.
- Cancelled events shown as cancelled, not hidden silently.

### S3.3 Event detail screen

The deep link target. Full event info plus availability controls.

- Reachable directly by URL.
- Renders correctly for a player who arrived cold from WhatsApp.

### S3.4 Changing a response

Players may change their answer until `starts_at`.

- After `starts_at`, controls are disabled with an explanatory line.
- Enforced in the database, not only the UI.

### S3.5 Own attendance history

Simple list of past events with attended / did not attend.

- Read-only for players.

## Epic 4 — Manager experience

### S4.1 Create event

Form: type, title, date, start time, location, optional notes. RHF + Zod.

- Title defaults sensibly by type, for example "Training" when type is training.
- Created event appears immediately in the team's list.
- Validation errors shown inline.

### S4.2 Edit and cancel event

Edit any field. Cancel sets status to `cancelled` rather than deleting. Hard delete available to admins only.

- Existing responses survive an edit.
- Cancelling is confirmed before it applies.

### S4.3 Manager event view

Event header plus counts: Available, Unavailable, Awaiting, and total squad size.

- Counts derive from squad membership, so players who never responded are counted as awaiting.
- Counts update live after any response change.

### S4.4 Player response table

Rows of player name, availability, attendance.

- Sorted with awaiting responses first.
- Readable on a 375px screen without horizontal scroll.

### S4.5 Record attendance

Per-player attended / did not attend toggle, editable after the fact.

- Defaults to blank, not to "attended".
- Bulk action to mark all available players as attended, then adjust.
- Records `recorded_by` and `updated_at`.

### S4.6 Recurring training

Manager sets day, time, location and a horizon, and the app generates individual event rows in advance.

- Generates concrete rows, no recurrence logic in read queries.
- Editing or cancelling one occurrence leaves the others untouched.
- Guard against generating an unbounded number of events. Cap the horizon.

## Epic 5 — WhatsApp sharing

### S5.1 Message generator

Pure function producing the share text from an event.

- Output matches the agreed format, including emoji, date line, location, and the `/#/event/{id}` link.
- Unit tested, including the Dublin timezone formatting.

### S5.2 Share action

`navigator.share()` where available, `wa.me` link as fallback.

- Works from iOS Safari, Android Chrome, and the installed PWA.
- Fallback opens WhatsApp with the message prefilled.
- The app never attempts to send a message itself.

### S5.3 Reminder share

Second variant of the generator for chasing outstanding responses.

- Reminder text differs from the initial share.
- Does not name individual non-responders in v1.

## Epic 6 — Admin

### S6.1 Teams

Create, rename, activate and deactivate teams.

### S6.2 Invites and members

Admins and managers generate a join link per team, shareable into the squad WhatsApp group. No manual user creation.

- Generate, revoke and regenerate a team join link. Revoking invalidates the old token immediately.
- Separate link for the manager role, generated by admins only.
- Member list shows name, phone, role, and join date, with remove, change-role and issue-reset-link actions.
- A user can hold different roles on different teams.
- Removing a membership does not delete historic responses or attendance.

### S6.3 All-teams view

Admin can view and administer any team's events.

## Epic 7 — Quality gate

### S7.1 State coverage audit

Every screen has loading, empty and error states. No unhandled promise rejections.

### S7.2 Unit tests

Vitest covering the message generators, date and timezone helpers, and count derivation.

### S7.3 End-to-end journey

Playwright test walking the full MVP success criteria: manager creates Saturday's match, copies the share link, a brand new user opens the link, registers with name, mobile and password, lands on that event, responds Yes, sees the install prompt, manager sees the updated counts, manager records attendance.

- Runs in CI against a seeded Supabase project.

### S7.4 Device pass

Manual check on a real iPhone and a real Android device: install to home screen, open a deep link from WhatsApp, respond, and share.

---

## Out of scope

Do not build, do not scaffold, do not leave TODOs for: chat, automated WhatsApp sending, push notifications, team selection, results, player stats, goals or cards, Veo, payments, match fees, fines, sponsorship, news, fundraising, membership or club registration forms, kit, transfers between squads, native apps.

Note: player self-registration by join link is in scope. Club membership registration is not.

## Definition of done

A story is done when: acceptance criteria are met, `typecheck` and `lint` are clean, tests for that story pass in CI, the four UI states are handled, and RLS still passes S1.4.
