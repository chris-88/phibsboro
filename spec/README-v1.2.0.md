# v1.2.0 — build plan

A small release scoped as the management team starts testing (2026-09-15). Two nice-to-haves that serve the
existing product rather than expand it: an **in-app feedback inbox** and **"who's in"** (players see who
else is available). Same conventions as before: one story per PR, build in order, a story isn't started until
its dependencies pass, RLS stays green. Decisions in `00-decisions-v1.2.0.md`; data model in
`data-model-v1.2.0.md`. `CLAUDE.md`'s out-of-scope list still holds — nothing here is stats, chat or push.

**New in v1.2.0, at a glance:** a "Send feedback" button anyone can use, landing in an admin inbox with the
reporter's context attached · a "Who's in" list on an event showing available teammates' names plus counts.

## Build order

| # | ID | Story | Epic | Depends on | Size | Status |
|---|---|---|---|---|---|---|
| 1 | S12.1 | Feedback data model + RLS | 12 Feedback | S1.4, S1.5 | S | ✓ |
| 2 | S12.2 | Submit feedback | 12 Feedback | S12.1, S2.9 | S | ✓ |
| 3 | S12.3 | Admin feedback inbox | 12 Feedback | S12.1, S6.3/S11 | M | ✓ |
| 4 | S13.1 | Availability RPC + RLS | 13 Who's in | S1.4, S4.3 | M | ☐ |
| 5 | S13.2 | "Who's in" on the event detail | 13 Who's in | S13.1, S3.3 | S | ☐ |
| 6 | S14.1 | Admin membership RPC + RLS | 14 Admin users | S1.4, S6.4 | S | ☐ |
| 7 | S14.2 | Admin &rarr; Users screen | 14 Admin users | S14.1, S11 | M | ☐ |
| 8 | S15.1 | Match jersey (field, detail, share) | 15 Jersey | S8.2, S9.3 | M | ✓ |

Epic 12 lands first because it is what makes the testing round useful — file it before the testers are deep
in. Epic 13 is independent and can follow.

## What each epic delivers
- **Epic 12 — In-app feedback:** a signed-in user taps "Send feedback", picks bug/idea/other, types a note,
  and sends it. It saves with the route, app version and device auto-attached. Admins read and resolve every
  report on an admin inbox screen — feedback in one queryable place instead of scattered across WhatsApp.
- **Epic 14 — Admin user manager:** an admin opens Admin → Users, sees every person and their team roles, and
  can assign anyone to any team, flip player↔manager, or remove them — a repair tool for when a normal path
  can't fix it. One admin-only RPC for the assign; role-change and remove reuse the existing member RPCs.
- **Epic 15 — Match jersey:** a manager picks the kit for a match — Black, Light Blue or White — on the match
  form; it shows on the event and rides along in the WhatsApp teamsheet ("Jersey: White").
- **Epic 13 — Who's in:** on an event, a player sees the names of teammates who've said they're Available,
  and counts for the rest ("9 in · 2 out · 3 awaiting"). Names are shown for the available only; who declined
  or hasn't answered is never revealed to a player. Served by a security-definer RPC so the privacy line is
  enforced in the database, not the UI.

## Not in v1.2.0 (flagged so it isn't assumed)
- Notifying you of new feedback (no push/email/SMS wired) — you check the inbox. A badge/count on the admin
  nav is the most it does.
- "Who's in" on the calendar day rows or the Home card (W5) — event detail only, to keep the calendar light.
- Threaded replies to feedback, categories beyond bug/idea/other, or feedback analytics.
