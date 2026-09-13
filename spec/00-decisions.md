# 00 — Decision record

Five auditors read `CLAUDE.md` independently. This file settles what they found. The brief remains the
product statement; this file is the ruling on every place the brief contradicts itself, leaves a rule
unstated, or asks for something that cannot be built or tested as written. Where the two disagree, this
file wins, and `spec/data-model.md` wins on schema. Decisions are numbered, ordered blockers first, and
every story spec cites the decisions it depends on. Rejected findings are listed at the end so nobody
raises them again. Nothing here widens scope: the out-of-scope list in the brief is untouched.

## Blocker decisions

| # | Title | Affects |
|---|---|---|
| D1 | One story ID per story; the duplicate S2.2 is deleted | S2.2, S2.5, S7.3 |
| D2 | Admin is club-wide, held on `profiles.is_admin` | S1.1, S1.3, S2.9, S6.1, S6.2, S6.3, S6.4 |
| D3 | Eight tables, no club entity | S1.1, S1.3, S1.4 |
| D4 | `profiles.id` is the `auth.users` id; every FK target fixed | S1.1, S1.2, S1.3, S1.5 |
| D5 | Composite primary keys, token and phone uniqueness | S1.1, S1.3, S2.3, S2.4, S6.2 |
| D6 | The event link is a deliberate bearer join credential | S2.1, S2.4, S2.5, S3.3, S5.1, S7.3 |
| D7 | Anonymous cold read via `get_event_preview` | S1.3, S1.4, S2.4, S2.5, S3.3 |
| D8 | `profiles` and `teams` get explicit read policies | S1.3, S1.4, S4.4, S6.4 |
| D9 | No client writes to `team_members` at all | S1.3, S1.4, S2.9, S6.4 |
| D10 | A manager may reset players only, and never a manager or admin | S2.3, S1.3, S1.4, S6.4 |
| D11 | Password reset is redeemed in Postgres, not in an Edge Function | S1.3, S2.3 |
| D12 | The response cut-off is an RLS policy in S1.3 | S1.3, S1.4, S3.4 |
| D13 | The WhatsApp message format is fixed literally | S5.1, S5.3, S7.2 |
| D14 | New story S0.7 — CI pipeline, running on a local Supabase stack | S0.1, S0.5, S1.4, S7.2, S7.3 |
| D15 | The seed is a Node script, and it moves to S1.2 | S1.1, S1.2, S1.4, S7.3 |
| D16 | Sentry needs sourcemaps, a release, and PII scrubbing | S0.5, S0.6 |
| D17 | Playwright drives `vite preview`, never the live site | S0.5, S7.3 |
| D18 | The deploy workflow applies migrations before publishing | S0.5, S1.1 |
| D19 | Phone auth is proved on a real project before Epic 2 starts | S1.2, S2.1, S2.2 |
| D20 | Build order of record, and S6.2 splits in two | all |

---

### D1 — One story ID per story; the duplicate S2.2 is deleted

**Issue** — The brief contains `### S2.2 Sign in` and, seven lines after S2.5, a second `### S2.2 Deep
link return path` which duplicates S2.5. It carries a criterion the auth design cannot satisfy:
"Restored after successful auth, including when auth redirects through an external callback." There is
no external callback — "no SMS is ever sent and there is no OTP step". With two stories sharing an ID,
"one story per PR" and per-story CI gating have no referent.

**Decision** — Delete the second S2.2 block. S2.2 is Sign in. S2.5 is Deep link return path and covers
both unauthenticated entries: a new user who registers, and an existing user who signs in. Drop the
external-callback clause. All auth is same-document: `signUp` and `signInWithPassword` resolve in place,
so the intended route is held in `localStorage` under `pfc.intendedRoute` to survive a cold start or a
browser switch, never a redirect. No callback route is added anywhere. One Playwright deep-link test,
owned by S2.5. Epic 2 has nine stories, S2.1 to S2.9. Nothing is renumbered.

**Rationale** — Stable IDs are a precondition for everything else in this repo.

**Affects** — S2.2, S2.5, S0.3, S7.3.

### D2 — Admin is club-wide, held on `profiles.is_admin`

**Issue** — Section 4 says "**Admin**: creates teams, manages users and memberships, administers all
teams", but the model stores role per team: `team_members ... role ('player'|'manager'|'admin')`, and
S1.3's helper is `is_admin()` with no team argument. An admin creating the first team would need
membership of a team that does not exist, and no invite in S6.2 grants admin.

**Decision** — Admin is a club-wide flag, not a membership role. Add `profiles.is_admin boolean not null
default false`. `team_members.role` and `team_invites.role` are restricted to `'player'|'manager'`.
`is_admin()` reads the flag for `auth.uid()`. No client path sets the flag and no RLS policy permits
updating it; the first admin is set by SQL in the seed and, in production, by a one-line migration
naming that person's number. This is the refinement the brief's "Refine it if needed, but flag the
change first" invites; it is flagged here.

**Rationale** — A club-wide role stored per team cannot express the state that exists before any team does.

**Affects** — S1.1, S1.3, S1.4, S2.9, S6.1, S6.2, S6.3, S6.4.

### D3 — Eight tables, no club entity

**Issue** — S1.1 says "Migration creating all six tables" while section 5 lists eight, and its seed
criterion creates "one club" when no `clubs` table exists. The miscount propagates into S1.3's "RLS
enabled on every table" and into S1.4's coverage.

**Decision** — Eight tables, named explicitly in S1.1: `profiles`, `teams`, `team_members`,
`team_invites`, `reset_tokens`, `events`, `event_responses`, `attendance`. No `clubs` table. The club is
implicit; the team is the top-level unit. The seed creates two teams, one admin, two managers, twenty
players, and at least one scheduled event, one past event and one cancelled event per team.

**Rationale** — A count that disagrees with the list is how a table ships with RLS off.

**Affects** — S1.1, S1.3, S1.4, S1.5.

### D4 — `profiles.id` is the `auth.users` id; every FK target fixed

**Issue** — Section 5 says `profiles id, name, phone` with no relationship to auth, and S1.1 asks for
"FKs" with no targets or on-delete behaviour, yet every RLS policy compares those columns to `auth.uid()`.

**Decision** — `profiles.id uuid primary key references auth.users(id) on delete cascade`, populated by
the S1.2 trigger with the same uuid. Every user-referencing column targets `profiles(id)`, never
`auth.users`: `user_id` columns `on delete cascade`; `created_by` and `recorded_by` are nullable and
`on delete set null`. Every `team_id` targets `teams(id) on delete restrict`. `event_id` columns target
`events(id) on delete cascade`. Full detail in `spec/data-model.md`.

**Rationale** — Policies compare to `auth.uid()`, so the join between auth and profile must be identity,
not a lookup.

**Affects** — S1.1, S1.2, S1.3, S1.5.

### D5 — Composite primary keys, token and phone uniqueness

**Issue** — S1.1 asks for "unique constraints on `(event_id, user_id)`" without saying whether those are
the primary keys, gives `team_members` no key at all, and never requires uniqueness on the token columns
the join and reset RPCs look up by.

**Decision** — Composite primary keys, no surrogate ids: `event_responses (event_id, user_id)`,
`attendance (event_id, user_id)`, `team_members (team_id, user_id)`. `unique` on `team_invites.token`,
`reset_tokens.token` and `profiles.phone`. "Unguessable" means 32 bytes from `gen_random_bytes(32)`,
base64url encoded, generated inside the issuing RPC and never client-side, so S1.4 can assert the length.

**Rationale** — A token column without a unique constraint is a lookup that can return two rows.

**Affects** — S1.1, S1.3, S1.4, S2.3, S2.4, S6.2.

### D6 — The event link is a deliberate bearer join credential

**Issue** — S2.4 says "`/#/event/{id}` from an unknown user does the same, joining the team that owns the
event, as a player", while S2.1 says registration is "Reachable only with a valid invite token" and S1.3
requires a join to validate `active` and `expires_at`. An event id has neither. As written, the journey's
entry point cannot be built.

**Decision** — Say plainly in the spec what the product already assumes: an event link is a standing join
credential with the same trust basis as the squad WhatsApp group. `events.id` is a `uuid` defaulting to
`gen_random_uuid()` — never sequential, never short. Joining by event link goes through
`join_team_by_event(p_event_id)`, which joins the caller as `'player'` and refuses when the team is
inactive, the event does not exist, or the event started more than 7 days ago. S2.1's first line becomes
"Reachable with a valid invite token or a valid event id. A bare visit to `/#/register` with neither is
rejected." Both the positive case and every refusal are tested in S1.4.

**Rationale** — Bolting a token onto the share link would break the fixed message format, tie revocation
to messages already sitting in WhatsApp, and buy nothing against an attacker who already needs a uuid.

**Affects** — S1.1, S1.3, S1.4, S2.1, S2.4, S2.5, S3.3, S5.1, S7.3.

### D7 — Anonymous cold read via `get_event_preview`

**Issue** — S1.3 says "Player can read events only for teams they belong to", but S3.3 requires the event
screen to render "for a player who arrived cold from WhatsApp" and S2.5 requires a brand new user to land
on that event. No anonymous read path exists.

**Decision** — Add a security-definer RPC `get_event_preview(p_event_id uuid)`, granted to `anon` and
`authenticated`, returning exactly team name, type, title, location, `starts_at` and `status` — never
`notes`, never `created_by`, never responses, counts or member lists. It returns zero rows for an unknown
id. The cold arrival and the signed-in non-member both see this read-only summary with one primary
button, "Join {team name}", which calls `join_team_by_event`. A signed-in user is never joined silently.
S1.4 asserts the preview leaks neither `notes` nor any response row.

**Rationale** — The one journey that matters starts with a stranger reading an event.

**Affects** — S1.3, S1.4, S1.5, S2.4, S2.5, S3.3, S7.3.

### D8 — `profiles` and `teams` get explicit read policies

**Issue** — S1.3's bullets cover events, responses, attendance, invites, members and reset tokens.
`profiles` and `teams` appear nowhere, yet S4.4 needs player names and S6.4 needs names and phone numbers.
The anon key is public, so the naive policy hands the club's phone directory to any account — and since
S1.4 tests "every policy in S1.3", the omission would also go untested.

**Decision** — `profiles`: a user may select their own row and no other. Every other display name comes
from the security-definer RPC `team_member_directory(p_team_id)`, which returns `user_id, name, role,
joined_at` to any member of that team and additionally returns `phone` only when the caller is a manager
of that team or an admin; for everyone else `phone` is null. `teams`: select is limited to teams you are
a member of, plus `is_admin()`; insert and update are `is_admin()` only; no client delete. A pre-auth
team name comes from the token lookup RPC or `get_event_preview`, never from a table select. S1.4 asserts
that a player selecting `profiles` gets exactly one row and that no non-manager obtains a phone number by
any route.

**Rationale** — Phone numbers are the account identifier here. They are the one thing worth protecting.

**Affects** — S1.3, S1.4, S1.5, S4.4, S6.4.

### D9 — No client writes to `team_members` at all

**Issue** — S1.3 forbids only direct INSERT: "Clients cannot insert into `team_members` directly."
UPDATE and DELETE are unspecified, so a player could promote themselves by updating their own row, and
S6.2's change-role action has no stated bound on who may grant what.

**Decision** — Clients have no INSERT, UPDATE or DELETE on `team_members`. All three go through
security-definer RPCs. `set_member_role(p_team_id, p_user_id, p_role)` grants or revokes `manager` and
requires `is_admin()`. `remove_member(p_team_id, p_user_id)` lets a manager remove only members whose
role is `player` on a team they manage; an admin may remove anyone. Admin is not grantable through the
app at all (D2). S1.4 has negative tests for: a player updating their own row, a manager promoting
themselves, and a manager promoting a player to manager.

**Rationale** — An unstated policy is an open one.

**Affects** — S1.3, S1.4, S2.9, S6.4.

### D10 — A manager may reset players only, and never a manager or admin

**Issue** — S2.3 opens "Managers and admins issue a one-time reset link for a member of their team" and
closes "Managers can only reset players on teams they manage." Those are different rules, and on the
wider one a manager can set a co-manager's or an admin's password and sign in as them. Nothing revokes
the victim's existing sessions.

**Decision** — The narrow rule, enforced in `issue_reset_token`. A manager may issue a reset only for a
user whose role is `player` on a team they manage, who holds no `manager` role on any team, and who is
not an admin. Only an admin may reset a manager. Nobody may reset an admin through the app; that is a
SQL job. Issuing revokes every unused, unexpired token for that user in the same transaction. Redeeming
marks `used_at`, revokes the user's other tokens, and deletes the target's refresh tokens so a stolen
link cannot leave a second silent session behind. `created_by`, `issued_at` and `team_id` are recorded so
the action is auditable. All three denials are tested in S1.4.

**Rationale** — A reset link is a full account takeover. The blast radius must stop at players.

**Affects** — S2.3, S1.3, S1.4, S2.6, S6.4.

### D11 — Password reset is redeemed in Postgres, not in an Edge Function

**Issue** — S2.3 requires setting a password for a user who has no session. There is no server-side
runtime in the stack, the anon client cannot change another user's password, and "No secrets in the repo"
forbids shipping a service-role key in the bundle. The brief never says what does the work.

**Decision** — `redeem_reset_token(p_token text, p_new_password text)` is a security-definer function
owned by a role with rights on the `auth` schema. It validates that the token is unused, unrevoked and
unexpired and that the password is at least 8 characters; writes
`crypt(p_new_password, gen_salt('bf'))` to `auth.users.encrypted_password`; marks `used_at`; revokes the
user's other tokens and refresh tokens; and returns that user's phone. The client then calls
`signInWithPassword` with the returned phone and the password just typed. No Edge Function, no
service-role key anywhere near the browser. Expired, used, revoked and unknown tokens all raise a single
`invalid_token` error the UI renders as "ask your manager for a new link".

**Rationale** — Postgres is the only server this project has. Use it.

**Affects** — S1.3, S1.4, S2.3, S6.4.

### D12 — The response cut-off is an RLS policy in S1.3

**Issue** — S3.4 says the `starts_at` cut-off is "Enforced in the database, not only the UI", but S1.3
lists no such policy. S1.4 is the blocking gate and tests "every policy in S1.3", so the rule would ship
untested and be discovered missing in Epic 3. Whether a cancelled event accepts responses is unstated.

**Decision** — S1.3 owns the rule. The player INSERT and UPDATE policies on `event_responses` carry
`WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.status =
'scheduled' AND e.starts_at > now() AND is_team_member(e.team_id)))`. A cancelled or started event
rejects new and changed responses; existing rows are untouched and stay readable. No player and no manager
may DELETE an `event_responses` row; admin only (A2). S1.4 gains four tests: response before start succeeds; after `starts_at`
refused; to a cancelled event refused; delete refused. The seed provides a past event and a cancelled
event for exactly this. S3.4 then owns only the UI half: disabled controls plus an explanatory line, for
both the past case and the cancelled case.

**Rationale** — A rule discovered in Epic 3 that belonged in the blocking gate is a rule that shipped.

**Affects** — S1.3, S1.4, S3.1, S3.2, S3.3, S3.4.

### D13 — The WhatsApp message format is fixed literally

**Issue** — S5.1's only functional criterion is "Output matches the agreed format", and no format appears
anywhere in the brief. Neither the function nor its unit test can be written.

**Decision** — The share message is exactly five lines, six when notes are present. `{emoji}` is `⚽` for
a match and `🏃` for training. `{dateLine}` is `formatEventTime(starts_at, 'share')`. `{url}` is
`` `${import.meta.env.VITE_APP_BASE_URL}/#/event/${id}` ``, one env constant, no string concatenation at
the call site.

```
{emoji} {title}
{dateLine}
{location}
{notes}          ← omitted entirely, with its line, when notes are null

Are you available? {url}
```

Worked example:

```
⚽ Kilbarrack away
Saturday 14 March, 7.30pm
Fairview Park pitch 3

Are you available? https://app.phibsboro.ie/#/event/9f1c...
```

The S5.3 reminder is the same first block with a different last line, and names nobody:

```
{n} still to answer. Yes or no: {url}
```

No club signature, no sender name, no extra emoji. Both variants are asserted byte for byte in Vitest.

**Rationale** — "Agreed format" with no format is an untestable criterion.

**Affects** — S5.1, S5.2, S5.3, S7.2, S7.3.

### D14 — New story S0.7, CI pipeline, running on a local Supabase stack

**Issue** — S1.4 says "Runs in CI", S7.3 says "Runs in CI against a seeded Supabase project", and the
definition of done says "tests for that story pass in CI", but no story builds a CI pipeline. S0.1 is
local only and S0.5 deploys from `main` only. Nothing says what happens on a pull request from a fork,
where GitHub withholds secrets.

**Decision** — Add **S0.7 CI pipeline** to Epic 0, built third, before Epic 1. `.github/workflows/ci.yml`
runs on `pull_request` and on `push` to `main`. Job `check`: typecheck, lint, `vitest run`, `vite build`.
Job `db` is added by S1.4; job `e2e` is added by S7.3. Both bring up the Supabase CLI local stack in the
runner and point at `http://127.0.0.1:54321` with the CLI's fixed local keys, which are published
constants and are committed in `.env.example`. **No test job requires a repository secret**, so fork pull
requests work. `pull_request_target` is never used. Hosted credentials belong only to the deploy
workflow, which triggers on `push` to `main`. `main` is protected and `check`, `db` and `e2e` are required
checks, so the S0.5 deploy runs only on a merge whose checks were green; the deploy workflow does not
re-run tests. S1.4 depends on S0.7.

**Rationale** — Three stories and the definition of done assume a pipeline nobody was asked to build.

**Affects** — S0.1, S0.5, S0.7, S1.4, S7.2, S7.3.

### D15 — The seed is a Node script, and it moves to S1.2

**Issue** — S1.1's seed must create "an admin, two managers, twenty players" before S1.2's profile trigger
exists. Those are Supabase Auth users with passwords, which a SQL seed cannot create correctly, and S1.4
must sign in as each of them.

**Decision** — S1.1 is migrations only, with one added criterion: `supabase db reset` applies every
migration from scratch on an empty database. The seed becomes `supabase/seed/seed.ts`, a Node script
owned by S1.2 and run after migrations. It creates every user with
`auth.admin.createUser({ phone, password, phone_confirm: true, user_metadata: { name } })` using the
service-role key, then inserts teams, memberships and events with a service-role client, then sets
`profiles.is_admin` on the admin. Seeded numbers and passwords are fixtures, written in the script and
documented in the story — they are not secrets. One seed artifact serves S1.1, S1.4 and S7.3; there is no
second fixture set. S1.4 runs `supabase db reset` plus the seed before each test file set, uses the
service-role key only in `tests/helpers/admin.ts` for setup, never for an assertion, and the service-role
key is never imported anywhere under `src/`.

**Rationale** — Auth users cannot be seeded in SQL, and the RLS suite needs to sign in as real ones.

**Affects** — S1.1, S1.2, S1.4, S7.3.

### D16 — Sentry needs sourcemaps, a release, and PII scrubbing

**Issue** — S0.6 requires "a readable stack trace" from a minified Vite bundle, with no sourcemap upload,
no release identifier and no Sentry token in the deploy workflow. Separately, the phone number is the
account identifier and will reach Sentry through user context, breadcrumbs and failed request payloads,
and nothing says to strip it.

**Decision** — The release is the commit SHA. Build with `build.sourcemap: 'hidden'` and
`@sentry/vite-plugin`; the S0.5 workflow sets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` as
repo secrets and `VITE_SENTRY_RELEASE: ${{ github.sha }}`, and deletes every `*.map` from the artifact
before publishing to Pages. Sentry init sets `sendDefaultPii: false`, identifies the user by auth uuid
only — never phone, never name — and installs `beforeSend` and `beforeBreadcrumb` hooks that redact
anything matching an E.164 or Irish mobile pattern from messages, breadcrumb data, URLs and request
bodies, and truncate anything after `/#/join/` and `/#/reset/` in URLs and transaction names. The
scrubber is a pure function with Vitest coverage. The S0.6 criterion is verified once per release by
calling `Sentry.captureException(new Error('sentry smoke'))` from the browser console on the deployed
site; no throw-on-purpose route ships. S0.6 depends on S0.5.

**Rationale** — An unreadable stack trace fails the story; a phone number in Sentry is a data leak.

**Affects** — S0.5, S0.6, S7.2.

### D17 — Playwright drives `vite preview`, never the live site

**Issue** — S7.3 never says what Playwright drives. Supabase config is baked in at build time, so E2E
needs its own build, and pointing it at `app.phibsboro.ie` would write to the production database and
race with deploys.

**Decision** — The `e2e` job builds from `.env.test`, pointing at the local Supabase stack, and Playwright's
`webServer` config serves `vite preview` on `http://127.0.0.1:4173`. E2E never touches
`app.phibsboro.ie`. S0.5 gains a separate post-deploy smoke job: one Playwright page opens the live
site, asserts the 404 screen renders for `/#/event/00000000-0000-0000-0000-000000000000` after a hard
reload, and asserts the loaded release string equals `github.sha`. No sign-in, no writes.

**Rationale** — A test suite that writes to production is not a test suite.

**Affects** — S0.3, S0.5, S7.3.

### D18 — The deploy workflow applies migrations before publishing

**Issue** — S0.5 deploys only the static site. No story applies migrations to the production Supabase
project, so a merged schema change and the frontend that needs it go out of step.

**Decision** — The S0.5 workflow gains a `migrate` job that runs before, and gates, the Pages publish job:
`supabase link --project-ref $SUPABASE_PROJECT_REF && supabase db push`, authenticated with
`SUPABASE_ACCESS_TOKEN` as a repo secret. Migrations are forward-only; a mistake is corrected by a new
migration, never by editing an applied one. New S0.5 criterion: a merge containing a new migration applies
it to the production database before the new bundle is published.

**Rationale** — Otherwise the first schema change breaks the live site.

**Affects** — S0.5, S1.1, S1.3.

### D19 — Phone auth is proved on a real project before Epic 2 starts

**Issue** — The whole trust model rests on a Supabase Auth configuration that is asserted and never
proved: "Phone confirmation is disabled in Supabase Auth config, so no SMS is ever sent". Supabase
normally requires an SMS provider before phone sign-up works at all, even with confirmations off. If that
holds, S2.1 and S2.2 cannot be built as written.

**Decision** — First task of S1.2, and a hard gate on all of Epic 2: on the real project, enable the
phone provider, disable phone confirmations, and sign up a user with no SMS provider credentials
configured. If it works, nothing changes. If it does not, switch to email auth with confirmations off,
deriving a synthetic address `{e164 without +}@phibsboro.invalid` inside the auth helper in
`src/lib/auth.ts`, so the number stays the only user-facing identifier and `profiles.phone` stays the only
stored one. Which path was taken is recorded in this file as an amendment before any Epic 2 work starts.
Either way, no SMS is ever sent, no OTP step exists, and a number is never proof of identity.

**Rationale** — Nine stories depend on a platform behaviour nobody has checked.

**Affects** — S1.1, S1.2, S2.1, S2.2, S2.3.

**Amendment, 2026-09-13 — path A. Phone auth works natively; the fallback is not taken.** Proved on
the hosted project (`hhhlbermhelfgxgkgitz`) with the phone provider enabled, `sms_autoconfirm` on and
every SMS provider credential null (`sms_provider` reads `twilio` but `sms_twilio_account_sid`,
`sms_twilio_auth_token` and `sms_twilio_message_service_sid` are all null; no send hook). With the
public anon key and supabase-js 2.116:

| Call | Result |
|---|---|
| `signUp({ phone: '+353899998801', password, options: { data: { name } } })` | `error: null`, `session` present, `user.phone` = `353899998801` (no `+`), `phone_confirmed_at` set, one `profiles` row with the same id, `phone` `+353899998801`, `is_admin` false |
| `signInWithPassword({ phone, password })` | `error: null`, session |
| `signInWithPassword({ phone, password: wrong })` | HTTP 400, `code: 'invalid_credentials'`, "Invalid login credentials" |
| `signUp` again with the same number | HTTP 422, `code: 'user_already_exists'`, "User already registered", no second auth user. **Not** `phone_exists` as S1.2 predicted; S2.1 matches on `user_already_exists` |
| `signUp` with no `name`, or a whitespace `name` | HTTP 500, `code: undefined`, `AuthRetryableFetchError`, "Database error saving new user"; `auth.users` count unchanged, no orphan. The trigger's raised name does **not** reach the client |
| `signUp` with a password of 6 characters (after `password_min_length` was set to 8) | HTTP 422, `code: 'weak_password'`, "Password should be at least 8 characters." |

No SMS was sent, no OTP step exists, and nothing above the database reads `phone_confirmed_at`.
Set through the Management API the same day: `password_min_length` 8 (was 6) and `site_url`
`https://app.phibsboro.ie` (was `http://localhost:3000`). Session and refresh settings untouched (S2.6).
The synthetic-email path in AC2 stays unbuilt; the trigger's metadata fallback remains only so the
same migration would serve if the platform behaviour ever changed. Epic 2 may start.

### D20 — Build order of record, and S6.2 splits in two

**Issue** — "Build in order... Do not start a story until the ones it depends on pass," but the epic order
is not a valid dependency order. Registration precedes the invites that gate it. The deep-link story
precedes the screen it lands on. Attendance history precedes the attendance it reads. The share stories
that produce the journey's entry link come after every story that assumes it circulates. And S6.2 bundles
invite-link lifecycle, which blocks Epic 2, with member administration, which depends on it.

**Decision** — S6.2 splits into **S6.2 Team join links** (generate, revoke, regenerate; player and manager
variants; manager links admin-only) and **S6.4 Member administration** (member list with name, phone, role
and join date; remove, change role, issue reset link, correct phone; a user holds different roles on
different teams; removing a membership does not delete history). Epic headings stay as documentation
groupings; the numbered sequence below is the build order of record. 43 stories.

| # | Story | # | Story |
|---|---|---|---|
| 1 | S0.1 Project scaffold | 23 | S2.3 Password reset by manager |
| 2 | S0.2 UI system | 24 | S3.4 Changing a response |
| 3 | S0.7 CI pipeline | 25 | S3.1 Home screen with next event |
| 4 | S0.5 Deployment | 26 | S3.2 Upcoming events list |
| 5 | S0.3 Routing | 27 | S2.7 Escape the WhatsApp browser |
| 6 | S0.4 PWA | 28 | S2.8 Add to home screen guide |
| 7 | S0.6 Observability | 29 | S4.1 Create event |
| 8 | S1.1 Schema | 30 | S4.2 Edit and cancel event |
| 9 | S1.2 Profile provisioning and seed | 31 | S4.3 Manager event view |
| 10 | S1.3 RLS policies and RPCs | 32 | S4.4 Player response list |
| 11 | S1.4 RLS test suite | 33 | S4.5 Record attendance |
| 12 | S1.5 Typed data layer and helpers | 34 | S3.5 Own attendance history |
| 13 | S6.1 Teams | 35 | S5.1 Message generator |
| 14 | S6.2 Team join links | 36 | S5.2 Share action |
| 15 | S2.9 Auth guard and role context | 37 | S5.3 Reminder share |
| 16 | S2.1 Registration | 38 | S4.6 Recurring training |
| 17 | S2.2 Sign in | 39 | S6.3 All-teams view |
| 18 | S2.6 Session persistence | 40 | S7.1 State coverage audit |
| 19 | S3.3 Event detail screen | 41 | S7.2 Unit tests |
| 20 | S2.4 Join by link | 42 | S7.3 End-to-end journey |
| 21 | S2.5 Deep link return path | 43 | S7.4 Device pass |
| 22 | S6.4 Member administration | | |

Deployment moves ahead of routing and PWA so their criteria are checkable on a real HTTPS origin. Team
creation and join links move ahead of Epic 2 so registration has a token to test against. Stories 19 to 33
read and write events the seed provides, so none of them waits on S4.1.

**Rationale** — The stated order cannot be followed literally without building stories against
prerequisites that do not exist.

**Affects** — every story.

---

## Major decisions

### D21 — The 60-second budget is a device measurement, not a CI assertion

**Issue** — S2.5 requires "The whole path from tapping the WhatsApp link to submitting a Yes is under 60
seconds for a new user" and "Covered by a Playwright test", with no device, network or start point
defined, and depending on Epic 3 and Epic 5 screens that do not exist when S2.5 is built.

**Decision** — Remove the timing figure from S2.5's automated criteria. S2.5's Playwright test asserts
instead that the new-user path from deep link to submitted Yes crosses no more than three screens and one
form submit. The 60-second measurement moves to S7.4 as a stopwatch check on a real mid-range Android on
mobile data, p50 over three runs, with the times pasted into the PR.

**Rationale** — A wall-clock budget on a shared CI runner flakes, gets skipped, and measures nothing.

**Affects** — S2.5, S7.3, S7.4.

### D22 — Squad means every current member of the team

**Issue** — S4.3 says "Counts derive from squad membership" without defining squad, and S6.4 keeps a
removed member's responses, so the four counts would not sum.

**Decision** — Squad is every current `team_members` row for that team, regardless of role. Managers are
counted and may respond; at this level managers play, and the primary key allows one role per user per
team so there is no other way to count a playing manager. Total squad size is the count of current
members. Awaiting is squad size minus responses from current members. Responses and attendance rows
belonging to users who are no longer members are retained in the database, excluded from every count, and
not shown in the manager list. Counts are computed as-of now, not as-of `starts_at`. Count derivation is a
pure function over squad rows plus response rows in `src/lib/`, so S7.2 tests it with no database, and it
asserts Available + Unavailable + Awaiting = squad size, including for an event with an orphaned response
row and for a squad of zero.

**Rationale** — One definition, stated once, that always sums.

**Affects** — S4.3, S4.4, S4.5, S6.4, S7.2.

### D23 — "Live" counts means polling, not Realtime

**Issue** — S4.3 requires counts to "update live", but the stack table names no realtime transport, so a
builder either adds Supabase Realtime — unlisted scope — or ships a screen that never refreshes.

**Decision** — No Supabase Realtime. The response mutation invalidates the event's counts query; the
manager event view sets `refetchOnWindowFocus: true` and `refetchInterval: 30_000` while mounted. S4.3's
criterion is reworded: counts refresh within 30 seconds of a response change and immediately on focus.

**Rationale** — A websocket for a squad of twenty is infrastructure nobody asked for.

**Affects** — S4.3, S4.4, S7.2, S7.3.

### D24 — Closed value sets are Postgres enums

**Issue** — Section 5 writes value sets as inline literals with no column type. As plain text,
`supabase gen types typescript` emits `string`, which collides with "Never hand-write row types" and with
the ban on `any`.

**Decision** — Four Postgres enums, created in the S1.1 migration: `event_type ('training','match')`,
`event_status ('scheduled','cancelled')`, `availability_response ('available','unavailable')`,
`member_role ('player','manager')`. Zod schemas in S1.5 use `z.enum` whose members are asserted equal to
`Database['public']['Enums'][...]`, so a value added in SQL breaks typecheck.

**Rationale** — The generated types are the contract; text columns make the contract meaningless.

**Affects** — S1.1, S1.5, S4.1, S7.2.

### D25 — Absence of an attendance row means "not recorded"

**Issue** — The absent-row rule is stated for `event_responses` only, but S4.5 requires attendance to
"default to blank" and `attended` is a plain bool.

**Decision** — The same rule applies to `attendance`: `attended boolean not null`, absence of a row means
not recorded, and "not recorded" is never stored as a value. S4.5's blank default is the absent row, and
clearing a toggle deletes the row. S3.5 and S4.4 both render three states: attended, did not attend, not
recorded. S4.5's bulk action inserts rows only for current members whose response is `available`.

**Rationale** — Two tables with the same three-state problem should have the same rule.

**Affects** — S1.1, S3.5, S4.4, S4.5.

### D26 — `team_members.joined_at`

**Issue** — S6.4 requires a join date; `team_members` has no timestamp column.

**Decision** — Add `joined_at timestamptz not null default now()`, rendered through `formatEventTime`.
The join RPCs insert `on conflict (team_id, user_id) do nothing`, so an idempotent re-join never resets
it. A role change leaves it untouched.

**Rationale** — The column the story needs does not exist.

**Affects** — S1.1, S2.4, S6.4.

### D27 — `reset_tokens` gains `revoked_at`, `issued_at` and `team_id`

**Issue** — S2.3 requires a new link to invalidate the previous one, but the table has only `used_at`,
which means redeemed, and nothing records which team the issuer acted under.

**Decision** — Add `revoked_at timestamptz null`, `issued_at timestamptz not null default now()` and
`team_id uuid not null references teams(id)`. A token is redeemable only when `used_at is null and
revoked_at is null and expires_at > now()`. `expires_at` defaults to `now() + interval '24 hours'`.
Issuing revokes every prior live token for that user in the same transaction.

**Rationale** — "Invalidates any previous one" needs a column to write.

**Affects** — S1.1, S1.3, S1.4, S2.3, S6.4.

### D28 — Invite lifetime and use count are fixed

**Issue** — `team_invites` carries `active` and `expires_at` but the brief never fixes their values, never
says single or multi use, and never distinguishes the player link from the manager link. A manager link
forwarded into the squad group would promote everyone who taps it.

**Decision** — The **player link** is multi-use, expires 90 days after issue, and there is at most one
active player link per team. The **manager link** is single-use, expires 24 hours after issue, is issuable
only when `is_admin()`, and is consumed on the first successful join. A partial unique index on
`(team_id, role) where active` enforces one live link per team per role. Regenerating is one RPC that
deactivates the current row and inserts a replacement in the same transaction. A signed-in user tapping a
spent or expired link gets the "ask your manager for a new link" screen.

**Rationale** — A manager invite with the same lifetime as a squad link is a privilege escalation waiting
in a group chat.

**Affects** — S1.1, S1.3, S1.4, S2.4, S6.2.

### D29 — Invites have a write path

**Issue** — S1.3 makes `team_invites` unselectable and defines only lookup and join RPCs, but S6.2
requires generate, revoke and regenerate, and no write path exists.

**Decision** — Add `create_team_invite(p_team_id, p_role)` returning the new token — permitted when
`is_team_manager(p_team_id)` for role `player`, and only when `is_admin()` for role `manager` — and
`revoke_team_invite(p_team_id, p_role)`. Regenerate is revoke-then-create in one transaction. Clients
never insert or update `team_invites`. S1.4 tests both, including a manager attempting to mint a manager
invite.

**Rationale** — S6.2 has three verbs and zero functions.

**Affects** — S1.3, S1.4, S6.2.

### D30 — `events.series_id`, capped at 16 weeks and 20 events

**Issue** — S4.6 generates a run of events with no column linking them, so the generator cannot detect it
already ran, and "Cap the horizon" names no number.

**Decision** — Add `series_id uuid null`, set on generated rows and on nothing else. No read query filters
on it. A partial unique index `(team_id, starts_at) where series_id is not null` makes re-running the
generator idempotent. The cap is 16 weeks ahead and at most 20 events per run, enforced in the Zod schema
and again in `generate_training_series`, which raises above either. The confirm step states the number:
"This creates 12 training sessions." Editing or cancelling one occurrence touches that row only and never
reads `series_id`.

**Rationale** — Without a series column the generator cannot be safely re-run; without a number the cap
cannot be tested.

**Affects** — S1.1, S4.6, S7.2.

### D31 — Hard delete cascades, and managers cannot delete

**Issue** — S1.3 grants managers "CRUD events" while S4.2 reserves hard delete to admins, and no on-delete
behaviour is defined for child rows, so the delete fails on a foreign key as soon as anyone has responded.

**Decision** — S1.3 reads: a manager may insert, select and update events for teams they manage; DELETE on
`events` requires `is_admin()`. `event_responses.event_id` and `attendance.event_id` are
`on delete cascade`, so an admin hard delete destroys that event's responses and attendance — stated in
S4.2 and confirmed behind a typed confirmation. `teams` stays `on delete restrict`: deactivate a team,
never delete one. S1.4 asserts a manager deleting an event on their own team affects zero rows.

**Rationale** — Two stories gave two answers, and neither made the delete possible.

**Affects** — S1.3, S1.4, S4.2, S6.1.

### D32 — A player reads only their own rows

**Issue** — S1.3 says what a player may write to `event_responses` and that they cannot write
`attendance`, but never what they may read from either, so S1.4 cannot write the negative test and S3.5
has no policy to rely on.

**Decision** — A player may select only their own rows in `event_responses` and `attendance`
(`user_id = auth.uid()`). They may not read another player's availability or attendance. Managers and
admins select all rows for teams they manage (see D33 for how that is scoped). S1.4 asserts a player
selecting a teammate's response row returns zero rows, not an error.

**Rationale** — Availability is mildly personal and there is no screen that needs it.

**Affects** — S1.3, S1.4, S3.5, S4.4.

### D33 — Historic rows survive a membership removal and stay readable

**Issue** — S6.2 promises "Removing a membership does not delete historic responses or attendance", but
every read policy is scoped by current membership, so the rows survive in the table and become invisible
to both the manager and the player.

**Decision** — Manager and admin read policies on `event_responses` and `attendance` are scoped by the
owning event's team (`is_team_manager(events.team_id)`), never by the responder's current membership, so a
leaver's rows stay readable. Player select policies are keyed on `user_id = auth.uid()` with no membership
test. A player may additionally select any `events` row for which they hold an `event_responses` or
`attendance` row, so leaving a team does not erase their own history. Deleting a `team_members` row
cascades to nothing.

**Rationale** — Retention that nobody can read is deletion with extra disk use.

**Affects** — S1.3, S1.4, S3.5, S4.3, S4.4, S6.4.

### D34 — The route list is extended now

**Issue** — S0.3 fixes the route table, but S2.1 references `/#/register`, S2.4 references
`/#/join/{token}`, S2.3 needs a set-password screen with no URL anywhere in the brief, S3.5 needs a
history screen and S6.4 needs a member list. A builder following S0.3 literally ships an app where every
invite and reset link hits the 404 screen.

**Decision** — S0.3's routes are: `/`, `/login`, `/register`, `/join/:token`, `/reset/:token`,
`/event/:id`, `/history`, `/manage`, `/manage/event/new`, `/manage/event/:id`,
`/manage/team/:teamId/members`, `/admin`, plus the 404. The reset link is `/#/reset/{token}`. Added
criterion: every route above resolves after a hard refresh on the deployed site, checked by the S0.5
post-deploy smoke job (D17).

**Rationale** — Four later stories silently widen a list the brief claims to fix.

**Affects** — S0.3, S2.1, S2.3, S2.4, S3.5, S6.2, S6.4.

### D35 — `formatEventTime()` and `toE164()` are S1.5 deliverables

**Issue** — Both are mandated by the conventions and consumed by at least seven stories, and no story
delivers either. S2.2 depends on the normaliser matching S2.1's exactly.

**Decision** — Both land in `src/lib/` with S1.5, with their unit tests. S7.2 then only confirms coverage.

```ts
export function formatEventTime(iso: string, style: 'share' | 'short' | 'time'): string
// 'share' → "Saturday 14 March, 7.30pm"   (year appended when not the current year)
// 'short' → "Sat 14 Mar, 7.30pm"
// 'time'  → "7.30pm"                      (minutes omitted on the hour: "7pm")
// Always Europe/Dublin. No ad-hoc toLocaleString anywhere in the codebase; lint rule enforces it.

export function toE164(input: string): string | null
// "087 123 4567" → "+353871234567"; "+353 87 123 4567" → "+353871234567"; nonsense → null
```

Supabase stores `auth.users.phone` without the leading `+`; the client always sends full E.164 and
`profiles.phone` always stores the `+` form. The S1.2 trigger prepends it.

**Rationale** — A helper with no owner gets written twice and drifts.

**Affects** — S1.2, S1.5, S2.1, S2.2, S3.1, S5.1, S7.2.

### D36 — Sign-in rate limiting is Supabase's job, plus a UX lockout

**Issue** — S2.2 says "Rate limit failed attempts per number" with no threshold and no enforcement point.
The browser calls GoTrue directly with the public anon key on a static host, so any limit the app applies
is advisory and a brute-forcer skips the app entirely.

**Decision** — Three checkable criteria replace one unbuildable one. First: Supabase Auth's built-in
sign-in rate limits are configured and the chosen values are committed in `supabase/config.toml` beside
the migrations. Second: the sign-in screen locks out for 30 seconds after five consecutive failures on the
typed number, labelled in the spec as UX, not enforcement. Third: the spec states plainly that password
brute force is bounded by Supabase's limits and the 8-character minimum, not by the app.

**Rationale** — Honest, checkable, and it does not pretend a client-side counter is a boundary.

**Affects** — S2.2.

### D37 — The registration gate is UX, and there is a fourth test role

**Issue** — S2.1 presents the invite-token requirement as a security boundary, but it is a route guard.
Anyone with the public anon key can call `auth.signUp` directly, so account creation is open by
construction.

**Decision** — State in the spec that the gate is on **membership**, never on account creation, and keep
S2.1's check as UX. Never describe it as a security boundary in any story. Then prove the real gate: S1.4
gains a fourth test role — a signed-in user with zero rows in `team_members` — asserted denied on every
table and every RPC except `get_event_preview` and the join RPCs.

**Rationale** — Someone will otherwise design a policy around the belief that only invitees have accounts.

**Affects** — S2.1, S1.2, S1.3, S1.4, S2.9.

### D38 — The anon key is public, not a secret

**Issue** — The conventions say "No secrets in the repo. Supabase URL and anon key via Vite env vars,
injected in CI", but both ship inside a bundle served from a public Pages site. Treating them as
confidential invites someone to lean on them instead of on RLS, and blocks a clean checkout from running.

**Decision** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public values baked into the published
bundle; all protection comes from the S1.3 policies as verified by S1.4. Both are GitHub Actions
repository **variables**, not secrets. `.env.example` commits the local-stack values so a clean checkout
runs without org access. Secrets are `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_PROJECT_REF` and `SENTRY_AUTH_TOKEN`. The service-role key never appears behind a `VITE_`
prefix and is never imported under `src/`.

**Rationale** — Calling a public value a secret produces bad security reasoning downstream.

**Affects** — S0.5, S0.7, S1.4, S7.3.

### D39 — Reverse-lookup indexes

**Issue** — The two indexes S1.1 names cover team listings only. Epic 3 filters the response and attendance
tables by `user_id`, which composite primary keys leading on `event_id` cannot serve.

**Decision** — S1.1 also creates `event_responses(user_id)` and `attendance(user_id)`, alongside
`events(team_id, starts_at)` and `team_members(user_id)`. Nothing else is warranted at this size.

**Affects** — S1.1, S3.1, S3.2, S3.5.

### D40 — shadcn sizes are overridden once, in S0.2

**Issue** — The stack mandates shadcn/ui and forbids hand-rolling, and the conventions mandate 44px touch
targets. shadcn's default button and input heights are below 44px, so the two rules conflict on every
screen.

**Decision** — Settled once in S0.2: override the `size` variants of the generated `button`, `input`,
`select` and `toggle` so the default variant is `min-h-tap` (44px; see [A16](#a16--the-44px-floor-is-spelled-min-h-tap)), with a spacing token defined alongside
the colour tokens. New S0.2 criterion: no interactive element renders under 44px at 375px.

**Affects** — S0.2, S3.1, S4.4, S4.5.

### D41 — Fixed bottom nav

**Issue** — S0.2 leaves "bottom nav or header appropriate to role" as an open choice inside an acceptance
criterion, blocking every screen in Epics 3, 4 and 6.

**Decision** — A fixed bottom nav for every role, padded with `env(safe-area-inset-bottom)`, with page
content bottom-padded to clear it. Items: Home and History for a player; plus Manage for a manager; plus
Admin for an admin. Full-screen routes reached by deep link — `/event/:id`, `/register`, `/join/:token`,
`/reset/:token` — hide the nav and show a back affordance, so the large YES / NO buttons are never
underneath it.

**Affects** — S0.2, S3.1, S3.3, S3.5, S4.3, S6.1.

### D42 — The response list is cards, not a table

**Issue** — S4.4's three columns plus S4.5's toggle cannot meet 44px inside 375px without horizontal
scroll, which S4.4 forbids.

**Decision** — One card per player at all widths. Line one: player name, availability pill right-aligned.
Line two: a full-width three-state segmented control (not recorded / attended / did not attend) at 44px
height. The S4.4 sort — awaiting first — applies to the card list. S4.5 uses the same component, so there
is one component, not two. S4.4 is renamed "Player response list".

**Affects** — S4.4, S4.5.

### D43 — Service worker strategy

**Issue** — S0.4 forbids a stale app shell but names no caching strategy, and with HashRouter every deep
link is served by the same `index.html`, so one stale shell breaks every WhatsApp link at once.

**Decision** — `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Navigation requests are network-first
with a 3-second timeout falling back to the cached shell. Hashed build assets are cache-first and
immutable. Supabase REST and RPC requests are never cached. Register with `skipWaiting` and
`clientsClaim`, and reload once on `controllerchange`. Checkable criterion, run in the `e2e` job: load the
preview build, replace the served output with a second build carrying a different release string, reload
twice, assert the new release string is on screen.

**Affects** — S0.3, S0.4, S0.5, S7.3.

**Reaffirmed 2026-09-12**, when a visible "new version available" refresh bar was proposed. Rejected, and
the reasoning is worth keeping: a prompt makes updating optional, and an optional update on a squad app
means a manager cannot rely on everyone having the fix they just shipped. `autoUpdate` keeps that
guarantee. The real gap the proposal identified was that nobody can tell which build a player is on, which
S0.4 AC14–AC16 close with a readable version string rather than with a prompt.

### D44 — iOS installability is a manual check, and `isStandalone()` is one helper

**Issue** — S0.4 asserts iOS installability against a Chrome-only automated check, and S2.8's suppression
rule, `display-mode: standalone`, does not match on iOS standalone.

**Decision** — Lighthouse installability covers Android Chrome only, gated in CI by
`treosh/lighthouse-ci-action` against `vite preview` with only the installable-manifest and service-worker
audits enabled. iOS coverage is the S7.4 device pass plus a build check that `apple-touch-icon` (180x180)
and `apple-mobile-web-app-capable` are present in `index.html`. One helper in `src/lib/`:

```ts
export const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
```

used everywhere instead of the media query alone.

**Affects** — S0.4, S2.7, S2.8, S7.3, S7.4.

### D45 — WhatsApp webview detection is per platform

**Issue** — S2.7 specifies user-agent detection, but on Android WhatsApp commonly opens links in a Chrome
Custom Tab carrying Chrome's own user agent and Chrome's session, so the detection is wrong in both
directions and the brief's claim that the webview "does not share Safari or Chrome's session" is wrong for
Android.

**Decision** — On iOS, treat it as an in-app webview when the UA contains `WhatsApp`, or the UA is WebKit
with no Safari UI. On Android, do not use the UA: wait up to 3 seconds for `beforeinstallprompt`; if it
fires, the player is in a real Chrome context and gets the S2.8 Install button; if it does not and
`isStandalone()` is false, show the S2.7 escape prompt. Correct the brief's claim in S2.7's context
section: the Android case may already share the Chrome session.

**Affects** — S2.7, S2.8.

### D46 — S2.7 and S2.8 are mutually exclusive

**Issue** — Both fire immediately after the player's first response, so a new player gets two stacked
prompts, one of which is dead copy because installing is impossible in the webview they are standing in.
S7.3 then asserts the install prompt appears in a flow that starts in that webview.

**Decision** — Ordered and exclusive. If the in-app webview is detected, show only the S2.7 escape prompt
and never the install guide. Otherwise, if `isStandalone()` is false, show only the S2.8 guide. Dismissals
persist in `localStorage` as `pfc.escapePromptDismissed` and `pfc.installGuideDismissed`; dismissal is
per-browser and does not follow a player from the webview to Safari, and the spec says so. No column is
added to the data model. S7.3 asserts the escape prompt on the WhatsApp-webview leg and covers the S2.8
guide in a second leg run with a mobile Safari or Chrome user agent.

**Affects** — S2.7, S2.8, S7.3.

### D47 — The escape prompt admits the second sign-in

**Issue** — The copy-link escape hatch drops the player into a browser with no session, forcing an
immediate second sign-in that the brief never acknowledges, at the moment it claims to reduce drop-off.

**Decision** — Say it in the copy rather than hiding it: "Open in Safari to add this to your home screen.
You'll sign in once more." Copy the absolute app root URL, not the event URL, so the player lands on
sign-in and then home. Show the S2.8 guide only after that sign-in succeeds. No session transfer between
browsers is attempted.

**Affects** — S2.6, S2.7, S2.8.

### D48 — Optimistic response updates have a defined rollback

**Issue** — S3.1 mandates an optimistic update with no rollback, no failure UI and no offline behaviour,
and it collides with D12, where the server rejects a write the UI has already shown as accepted.

**Decision** — TanStack Query: `onMutate` snapshots the cached response; `onError` restores it and renders
an inline line under the buttons, "Couldn't save. Tap again.", leaving the buttons enabled; `onSettled`
invalidates the event and counts queries. The disabled-after-start state is computed from `starts_at`
against a server timestamp fetched with the event, never the device clock. No offline write queue.

**Affects** — S3.1, S3.3, S3.4, S7.1.

### D49 — Empty and error states are specified per screen, now

**Issue** — The conventions demand four states everywhere and S7.1 audits them, but only S3.1 names one,
so S7.1 becomes a rework story rather than a check.

**Decision** — Each story spec fills the UI-states table in the template. The known ones are fixed here.
S3.3: event not found (404 screen); event on another team, or unknown user (preview plus a single "Join
{team}" button); event cancelled (banner, controls disabled); after `starts_at` (controls disabled with a
line). S3.5: "No past events yet." S4.3 and S4.4: a squad with no members shows "No one has joined this
team yet" plus the join-link share button. S6.1: "No teams yet." S6.4: no members; a failed revoke shows
an inline retry. Every error state is an inline message with a retry control, never a blank screen. The
S0.6 error boundary is the last resort, not the design.

**Affects** — S3.3, S3.5, S4.3, S4.4, S6.1, S6.4, S7.1.

### D50 — S6.1 and S6.3 get acceptance criteria, and `teams.active` gets meaning

**Issue** — Both are one-sentence stories with no criteria, so neither can meet the definition of done,
and `teams.active` has no defined behaviour anywhere.

**Decision** — S6.1: admin-only screen; create takes a name and nothing else; the name is unique
case-insensitively and non-empty; rename is inline; deactivating is confirmed before it applies.
`teams.active = false` means: the team is hidden from every non-admin list, event insert for it is
refused, and `join_team_by_token` and `join_team_by_event` both refuse — all enforced in RLS and the RPCs,
not the UI — while existing events, responses and attendance stay readable to admins and to members.
Deactivated teams appear in a separate section. S6.3: the admin team picker lists all teams, active first,
inactive in a second section; selecting one renders the identical manager event views scoped to that team,
with no separate code path. Both handle four UI states. The deactivation rules are tested in S1.4.

**Affects** — S1.1, S1.3, S1.4, S6.1, S6.3, S7.1.

### D51 — An admin can correct a member's phone number

**Issue** — Numbers are unique and unverified, so one typo or one deliberate squat permanently locks the
real owner out of registering, and S6.2's actions offer no way to correct or release a number.

**Decision** — One admin-only action in S6.4, implemented as `set_member_phone(p_user_id, p_phone)` guarded
by `is_admin()`, updating `auth.users.phone` and `profiles.phone` in one transaction and returning a clean
duplicate error, not a Postgres unique violation. Managers do not get this action. There is no
self-service phone change. This is the only remedy, and it is deliberately narrow.

**Rationale** — Without it, one fat-fingered signup is unfixable except in SQL.

**Affects** — S6.4, S1.2, S1.3, S1.4, S2.1.

### D52 — `wa.me` gets a percent-encoded body

**Issue** — The share link contains `#`, which truncates the message at the fragment unless the whole body
is percent-encoded into the `wa.me` URL — a failure that only shows up on a real phone.

**Decision** — Build the fallback as `` `https://wa.me/?text=${encodeURIComponent(message)}` ``. S7.2
asserts the encoded output contains `%23%2Fevent%2F`. Pass the same untouched message string to
`navigator.share({ text })` with no `url` field, so the link stays inside the message body.

**Affects** — S5.1, S5.2, S7.2, S7.4.

### D53 — Timezone is pinned in CI

**Issue** — Every date assertion depends on the runner's timezone and the time of year. Dublin tests that
pass locally in July fail on a UTC runner in January.

**Decision** — `TZ=UTC` in the CI job environment and in `vitest.config.ts`; `timezoneId: 'Europe/Dublin'`
set explicitly on the Playwright project. `formatEventTime` tests cover a GMT instant (January), an IST
instant (July) and both DST boundaries, all as fixed UTC instants.

**Affects** — S1.5, S5.1, S7.2, S7.3.

### D54 — S1.4 proves every table is protected

**Issue** — S1.4's coverage is defined per policy listed in S1.3, so a table with RLS off, or with no
policy at all, passes the suite by having no test.

**Decision** — S1.4 gains a test that enumerates `pg_tables` in schema `public` and fails if any table has
`rowsecurity` false, and a second that fails if any table has zero rows in `pg_policies` unless it is on an
explicit deny-all list (`team_invites`, `reset_tokens`, which are RPC-only by design).

**Affects** — S1.3, S1.4.

### D55 — S1.4's gate exempts the Epic 0 shell

**Issue** — S1.4 says "Do not proceed to UI without it", but the build order puts the shell, routing and
PWA ahead of it.

**Decision** — Reword the gate: "Blocking story. No feature UI that reads or writes team data ships before
this passes." The Epic 0 shell, routing and PWA scaffolding are exempt because they touch no data.

**Affects** — S0.2, S0.3, S0.4, S1.4.

### D56 — The definition of done has stated exemptions

**Issue** — The definition of done sets gates some stories cannot satisfy: S0.1 to S0.7 all precede S1.4;
S0.5 and S0.6 add no screens; S7.4 is manual and can never run in CI.

**Decision** — Amend it. The S1.4 gate applies from S1.4 onward. The four-states gate applies only to
stories that add or change a screen. S7.4 is signed off by committing `docs/device-pass.md` with device,
OS version, browser version, date and tester, and pasting it into the PR. Each exemption is written into
that story's own Definition of done block rather than left to inference.

**Affects** — S0.1 to S0.7, S1.4, S7.4.

### D57 — Epic 7 is verification, not where tests get written

**Issue** — The definition of done requires tests with every story, but Epic 7 schedules unit and E2E
testing as later stories, so a builder cannot tell whether to write tests now or defer.

**Decision** — Every story ships its own tests. S7.1 is an audit producing a fix list. S7.2 adds only the
cross-cutting cases nobody owns: DST boundaries, count derivation with an empty squad and with an orphaned
response row, the Sentry PII scrubber, and the `wa.me` encoding. S7.3 is the only genuinely new test
artifact in the epic. The epic heading says so.

**Affects** — S7.1, S7.2, S7.3.

---

## Minor decisions

### D58 — E2E is repeatable

The `e2e` job runs `supabase db reset` plus the seed before Playwright, so every run starts identical.
The registration test builds its number from a reserved prefix documented in the seed script —
`+3538990` plus a five-digit run-scoped suffix, giving twelve digits such as `+353899012345` — so a half-finished run never blocks the next one, and
no real player is ever assigned that range. **Affects** — S1.2, S7.3.

### D59 — Session longevity is a configuration assertion

S2.6 is restated as configuration plus a proxy: JWT expiry 3600s, refresh token rotation on, refresh token
inactivity window 365 days, `persistSession: true` and `autoRefreshToken: true` on the Supabase client,
all committed in `supabase/config.toml`. A Vitest test stubs an expired access token and asserts a single
silent refresh with no navigation to `/login`; a Playwright test reloads with a stored session and asserts
no login flash. The 24-hour and season-long claims are checked by reading the config, not by waiting.
**Affects** — S2.6, S7.2, S7.3.

### D60 — Cancelled events never occupy the next-event card

The next-event card shows the next `status = 'scheduled'` event only. Cancelled events still appear in the
S3.2 list, marked cancelled. On the event detail screen a cancelled event shows a banner reading "This
one's off." with the availability controls disabled; the D12 policy already blocks the write.
**Affects** — S3.1, S3.2, S3.3, S3.4, S4.2.

### D61 — A response cannot be cleared

Tapping the currently selected answer is a no-op. A player switches between YES and NO but cannot return
to awaiting, and no deselect affordance is rendered. No player or manager DELETE on `event_responses` (D12, A2).
**Affects** — S1.3, S3.1, S3.4.

### D62 — Tokens are stored in plaintext, and never logged

Tokens are generated inside the issuing RPC (D5), stored in plaintext in tables no client can select, and
never written to logs, Sentry, or a query string the app itself constructs. Sentry truncates anything
after `/#/join/` and `/#/reset/` (D16). A manager must be able to re-copy a live join link at any time,
which a hash would prevent. **Affects** — S1.1, S1.3, S0.6, S6.2.

---

## Amendments

Added after the three spec reviews. Each corrects or completes a decision above; the story specs already
read this way. Nothing here widens scope.

### A1 — `get_team_invite` is the fourteenth RPC

D62 requires a manager to be able to re-copy a live join link at any time, but no read path existed:
`team_invites` is unselectable by clients and `lookup_team_invite` takes a token nobody can look up.
`get_team_invite(p_team_id uuid, p_role member_role)` is added to `data-model.md`, to S1.3 (its signature
block, grant table, AC26 and the RPC count, now fourteen) and to S1.4's matrix as row 31a. It returns the
live row to a manager of that team for `player`, and to an admin for either role, and zero rows on every
other path. **Amends** D62, S1.3, S1.4, S6.2, `data-model.md`.

### A2 — Admin DELETE on `event_responses` is permitted

D12 and D61 say "clients have no DELETE on `event_responses` at all". Read that as **no player and no
manager**. The admin policy is `for all`, and the grant exists so it can be used. S1.4 tests the refusal
for player and manager only. **Amends** D12, D61.

### A3 — `redeem_reset_token` is granted to `authenticated` as well as `anon`

A player still signed in on an old session may open a reset link. The token, not the session, is what
authorises the redemption. `data-model.md`'s anonymous-reach line is corrected to match S1.3's grant
table. **Amends** `data-model.md`, and closes S2.3 open question 1.

### A4 — The reserved E2E phone range is `+3538990` plus five digits

D58's `+35389900` plus five digits is thirteen digits and is rejected by `toE164()` and by
`profiles.phone`'s check, so the registration journey could never run. The range is `+3538990` plus a
five-digit run-scoped suffix — `+353899012345`, twelve digits, `089 90XXXXX` — which no real player is
assigned and which does not collide with the seed's `+3538999…` fixtures. **Amends** D58, S1.2, S7.3, S7.4.

### A5 — Who creates which CI job

D14 says S0.7 creates `.github/workflows/ci.yml`, S1.4 adds `db` and S7.3 adds `e2e`. Two corrections.
**S1.1** is the first story needing a Postgres in the runner, so S1.1 creates the `db` job and S1.4 extends
it with the seed step and the RLS project. **S2.5** is built twenty-one places before S7.3 and must run a
Playwright test to meet the definition of done, so S2.5 creates the `e2e` job and S7.3 extends it.
`playwright.config.ts` itself is S0.5's, created at build-order position 4. S0.7 pins the Supabase CLI
version once, as `SUPABASE_CLI_VERSION`, for every job that starts the stack. **Amends** D14, D17, S1.1,
S1.4, S2.5, S7.3. Closes S7.3 open question 1.

### A6 — Three query-key factories, all declared by S1.5

Seven stories had declared their own factory or written a literal key, so prefix invalidation no longer
covered what it claimed to. `src/api/queryKeys.ts` exports exactly three — `eventKeys`, `teamKeys`,
`userKeys` — all declared by S1.5, all shaped `['<entity>', '<what>', <id>]`. Later stories add members to
those objects and never declare a fourth or write a string literal. `qk`, `joinKeys`, `historyKeys`,
`teamKeys.directory` and `queryKeys.members.byTeam` do not exist. **Amends** S1.5 AC15 and every consumer.
Closes S4.1's query-key open question.

### A7 — Schemas are feature-first; hooks live in `src/api/`

`CLAUDE.md` section 3 says both "structure by feature" and "all Supabase reads/writes go through hooks in
`src/api/`". The split is: one Zod schema module per entity under `src/features/<feature>/schema.ts`
(S1.5's table), and every query and mutation hook under `src/api/`, one module per entity. There is no
`src/lib/schemas/` and no `src/features/<feature>/api/`. **Amends** S1.5 and the Epic 3, 4 and 6 stories.

### A8 — One URL builder: `src/lib/paths.ts`

S0.3 AC8 permits the literal `/#/` in exactly one file. `eventUrl`, `joinUrl` and `resetUrl` all live in
`src/lib/paths.ts`. `src/lib/shareMessage.ts` (S5.1) keeps the message builders and imports the URL;
`src/features/auth/resetLink.ts` and `src/lib/urls.ts` are never created. **Amends** S2.3, S5.1, S6.4.
Closes S0.3 open question 3.

### A9 — One clipboard helper, owned by S6.2

`copyText()` in `src/lib/clipboard.ts` is created by S6.2, the first story that needs it at build-order
position 14, and imported by S2.3, S2.7, S5.2 and S6.4. Three implementations of a ten-line function were
specified; there is one. **Amends** S2.3, S2.7, S5.2, S6.2, S6.4.

### A10 — Issuing a reset link belongs entirely to S2.3

S2.3 and S6.4 both specified the issuing dialog, differently. S2.3 owns it whole — the D10 predicate, the
component, the dialog, the copy and `useIssueResetToken()` — because it also owns redemption. S6.4 leaves a
row-action slot on each member card and nothing else. **Amends** S2.3, S6.4.

### A11 — `recorded_by` is refused, not rewritten

S1.3's `attendance_manager_all` `with check` already refuses a row carrying anyone else's uid, and S1.4
row 22 proves it. A `before insert` trigger stamping `auth.uid()` would run ahead of that check and turn
the negative test green, so S4.5 ships no such trigger and no migration: the client sends
`recorded_by: user.id` on every write. **Amends** S4.5.

### A12 — The error vocabulary is six words

`starts_in_past` is part of the vocabulary from S1.3 onward, not a sixth word bolted on by S4.6:
`invalid_invite`, `invalid_token`, `not_authorised`, `phone_taken`, `series_too_long`, `starts_in_past`.
**Amends** S1.3 AC23, S1.4, S1.5 AC9, S4.6.

### A13 — The datetime module is `src/lib/time.ts`, and the Intl ban is narrow

D35 names the file `src/lib/time.ts`; S0.1's lint override and lint messages say so from build-order
position 1. The `no-restricted-syntax` selector is
`NewExpression[callee.object.name='Intl'][callee.property.name='DateTimeFormat']`, not every `new Intl.*`
— `Intl.Collator` is used for name sorting in four stories and is not banned. **Amends** S0.1, S7.1.

### A14 — `src/features/install/` is a sixth feature directory

The S2.7 and S2.8 prompts are shared by two screens and owned by neither, so they sit in
`src/features/install/` rather than under `events` or `availability`. This is the refinement `CLAUDE.md`
section 3's structure rule permits, flagged here. No seventh directory follows. **Amends** S2.7, S2.8.

### A15 — Sign-in rate limiting is per IP and per browser, not per number

`CLAUDE.md` S2.2 asks for a rate limit "per number". Nothing in the design can enforce that without a
server-side attempt counter, and D36 already rejected the `auth_attempts` table as theatre the client can
skip. What ships is Supabase's per-IP limit plus a per-browser lockout, and S2.2's copy nowhere claims it
stops an attacker. The brief's wording is superseded by D36 as amended here. **Amends** D36, S2.2.

### A16 — The 44px floor is spelled `min-h-tap`

Three spellings were in use. `min-h-tap` is the floor; `min-h-11` is never written. A control deliberately
taller than the floor uses Tailwind's own scale (`min-h-14`) and is not a violation. **Amends** D40, S0.2,
S2.1, S4.4, S4.5, S4.6.

### A17 — Playwright specs live in `tests/e2e/`

Four stories wrote `e2e/` and ten wrote `tests/e2e/`. It is `tests/e2e/`, which is S0.5's `testDir` and
matches `tests/db/` and `tests/rls/`. The single service-role client is `tests/helpers/admin.ts`, S1.2's,
not `tests/rls/helpers/admin.ts`. **Amends** S0.4, S0.5, S1.4, S3.4, S3.5.

### A18 — The stale-shell check belongs to S0.4 alone

S0.4 AC5 and S7.3 AC12 both specified the two-build service-worker check. S0.4 keeps it, at build-order
position 6; S7.3 asserts nothing about the service worker and drops the extra project, the second web
server and the two extra builds. **Amends** D43, S7.3.

### A19 — The journey spec dispatches `beforeinstallprompt`

Under D45, an Android context with no `beforeinstallprompt` resolves to `android-inapp`, and D46 then
renders only the escape prompt. S7.3 AC1 and AC11 had expected the written install steps in that leg. The
journey spec dispatches a synthetic event and asserts the Install button; the no-event leg asserts the
escape prompt, and the written steps only behind S2.8's menu item. **Amends** S7.3.

### A20 — Every foreign key carries a covering index

D39 said the four reverse-lookup indexes were all that was warranted. Supabase's performance advisor,
run after the S1.1 schema was applied, flagged the five foreign keys without one: `team_invites.created_by`,
`reset_tokens.team_id`, `reset_tokens.created_by`, `events.created_by` and `attendance.recorded_by`. They
serve the `on delete set null` and `restrict` scans when a profile or team is deleted, cost nothing at
this size, and keep the advisor clean so a real finding is not lost in noise. Shipped as a second S1.1
migration because the first had already been applied to the hosted project when the advisor ran, and an
applied migration is never edited. No read query filters on any of these columns; D39's rule for
query-serving indexes stands. **Amends** D39, `data-model.md`, S1.1.

---

## Rejected

- **sha256-hashing invite and reset tokens.** A manager must be able to re-copy the live join link from
  the members screen; a hash makes the link show-once. The tables are unselectable by clients and the
  prize is joining a football team. D62 covers the handling that matters.
- **An `auth_attempts` table with `signin_allowed` / `record_failed_signin` RPCs.** The client can skip
  them entirely, so they buy no protection for two RPCs and a table. D36 is the honest version.
- **IP-based throttling inside RPCs.** Postgres has no reliable client IP behind PostgREST. Security theatre.
- **Adding `?t={token}` to the share link.** Breaks the fixed message format, and ties revocation to
  messages already sitting in WhatsApp. D6 settles the trust model instead.
- **Supabase Realtime for live counts.** Not in the stack table, and D23 is enough for a squad of twenty.
- **A `clubs` table.** One club, implicit. The team is the top-level unit.
- **A surrogate `id` on `team_members`, and a `role_updated_at` column.** Nothing reads either.
- **Excluding managers from the squad counts.** D22 counts everyone; managers at this level play.
- **Flagging "left squad" rows in the manager response list.** Extra UI for a rare case. D22 excludes them
  from the list and D33 keeps the rows.
- **An offline write queue for responses.** Out of scope, and the journey assumes a live tap.
- **Renumbering the surviving deep-link story to S2.10.** Churn. D1 keeps S2.5.
- **Playwright asserting a 60-second wall clock.** D21 moves it to a real device where it means something.
- **A throw-on-purpose route to verify Sentry.** D16 uses a console call on the deployed site instead.

---

## Story ID map

The definitive list. 43 stories. Authors use these IDs and these titles, and no others. The build order
is D20, not this list.

| ID | Title |
|---|---|
| S0.1 | Project scaffold |
| S0.2 | UI system |
| S0.3 | Routing |
| S0.4 | PWA |
| S0.5 | Deployment |
| S0.6 | Observability |
| S0.7 | CI pipeline *(new, D14; see A5 for which story creates which job)* |
| S1.1 | Schema |
| S1.2 | Profile provisioning and seed |
| S1.3 | RLS policies and RPCs |
| S1.4 | RLS test suite |
| S1.5 | Typed data layer and shared helpers |
| S2.1 | Registration |
| S2.2 | Sign in |
| S2.3 | Password reset by manager |
| S2.4 | Join by link |
| S2.5 | Deep link return path *(absorbs the deleted duplicate S2.2, D1)* |
| S2.6 | Session persistence |
| S2.7 | Escape the WhatsApp browser |
| S2.8 | Add to home screen guide |
| S2.9 | Auth guard and role context |
| S3.1 | Home screen with next event |
| S3.2 | Upcoming events list |
| S3.3 | Event detail screen |
| S3.4 | Changing a response |
| S3.5 | Own attendance history |
| S4.1 | Create event |
| S4.2 | Edit and cancel event |
| S4.3 | Manager event view |
| S4.4 | Player response list *(renamed, D42)* |
| S4.5 | Record attendance |
| S4.6 | Recurring training |
| S5.1 | Message generator |
| S5.2 | Share action |
| S5.3 | Reminder share |
| S6.1 | Teams |
| S6.2 | Team join links *(split, D20)* |
| S6.3 | All-teams view |
| S6.4 | Member administration *(split, D20)* |
| S7.1 | State coverage audit |
| S7.2 | Unit tests |
| S7.3 | End-to-end journey |
| S7.4 | Device pass |

There is no S2.10. There is no second S2.2.

---

### D63 — One project. Tests truncate freely until go-live

**Issue** — S1.4's RLS suite creates users, teams and events as every role and asserts the denied paths
as well as the permitted ones. The obvious implementation truncates between runs. There is one Supabase
project, so that wipes whatever is in it.

**Decision** — Let it truncate. One project, no fixture-scoping ceremony.

The project holds no real data and will not until the club's members register. Until then the cost of a
test run is a re-seed, which `npm run db:seed` does in seconds. Scoping every fixture to a run id, and
policing it with lint rules, buys nothing today and makes the suite harder to read — the opposite of what
`CLAUDE.md` asks for.

The suite prints the project ref and the row counts it is about to destroy before it does, so nobody is
ever surprised by what it wiped.

**This has one expiry date, and it is go-live.** The moment real members register, a CI run that truncates
production is a data-loss incident. `docs/database.md` carries the go-live checklist; the item is: point
the RLS suite at a separate project, or stop running it in CI against production. An organisation-scoped
personal access token creates that second project in a minute — the current token cannot, which is why
this decision exists rather than a second project simply being provisioned.

**Rationale** — The right amount of safety machinery for a database with no data in it is none. The real
control is a go-live gate, not a lint rule.

**Supersedes** — an earlier version of this decision that required run-id-scoped fixtures and forbade
`truncate` under `tests/`. That was solving a problem the project does not yet have.

**Affects** — S1.4, S1.2, S7.3, and `docs/database.md`.

### D64 — The app lives at app.phibsboro.ie

**Issue** — `CLAUDE.md` names `app.phibsborofc.com` as the custom domain, and forty-two references across
the specs, the deploy workflow and the share-message format followed it. That domain **is not registered**:
the .com registry returns 404 for it. The club's real domain is `phibsboro.ie`, live at Letshost.

**Decision** — The app is served from `app.phibsboro.ie`, a CNAME to `chris-88.github.io` added in
Letshost's DNS. The existing site at the `phibsboro.ie` apex is untouched — different record, different
host. `phibsborofc.com` is not registered and will not be. Every reference is renamed, including D13's
share message, which now reads `https://app.phibsboro.ie/#/event/{id}`. The synthetic auth email domain
becomes `@phibsboro.invalid`.

**This must happen before any player installs the app.** A PWA installed from
`chris-88.github.io/phibsboro/` does not follow a domain change: the home-screen icon keeps pointing at the
old origin and the service worker's scope is tied to it, so an installed player would be stranded and have
to delete and re-add. S2.8 exists to earn exactly one install; it should be spent on the final address.
The same applies to every WhatsApp message already sent, since D13 embeds the URL.

**Rationale** — Using the club's real domain costs nothing, adds no renewal for a volunteer committee to
forget, and is the address players already recognise when a link arrives from a manager.

**Amends** — `CLAUDE.md` section 2, D13, S0.5, S5.1, S5.3, S0.3, S0.6, S2.7, S3.3, S7.3, S7.4.

## Deferred questions

The club answers these. Each has a proposed default, already written into the specs, so no story waits.

| # | Question | Proposed default |
|---|---|---|
| Q1 | Do managers play, and should they be counted in the squad? | Yes. D22 counts every current member regardless of role. |
| Q2 | Is the share message wording right? | D13's template, verbatim. Change the strings, not the shape. |
| Q3 | ⚽ for a match and 🏃 for training? | Yes. One emoji, first character, no others. |
| Q4 | How far ahead should recurring training generate? | 16 weeks, capped at 20 events per run (D30). |
| Q5 | How long should a squad join link live? | 90 days, multi-use, one live link per team (D28). |
| Q6 | Who is the first admin? | Chris Quinn's number, set by a one-line migration on the production project (D2). |
| Q7 | What are the two team names at launch? | "Firsts" and "Seconds". Renameable in S6.1. |
| Q8 | Should players see each other's availability? | No. Own rows only (D32). Managers see the squad. |
| Q9 | Should the reminder message say how many are outstanding? | Yes, a number, never a name (D13, S5.3). |
| Q10 | How long do we keep a removed member's history? | Forever. Nothing is ever deleted on removal (D33). |
| Q11 | Should a player be able to change their own name or number? | No. Number correction is admin-only (D51); there is no profile edit screen in v1. |
| Q12 | ~~Is the domain ours to point?~~ | **Answered.** `phibsborofc.com` was never registered; the app uses `app.phibsboro.ie`, DNS at Letshost (D64). |
| Q13 | Should the RLS suite get its own Supabase project? | Not before go-live. One project, tests truncate, re-seed after (D63). At go-live it must move. |
