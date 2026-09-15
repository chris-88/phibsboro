# v1.2.0 — Decision record

v1.2.0 is a "testing-phase" release, scoped while the management team starts using the app. Nice-to-haves:
an **in-app feedback inbox** (Epic 12), **"who's in"** (Epic 13, players see who else is available), an
**admin user/membership manager** (Epic 14, a god-mode repair tool), and a **match jersey** (Epic 15).
Decisions here extend `00-decisions.md` and `00-decisions-v1.1.0.md`.

Both features stay inside the app's "keep it boring, serve the core loop" ethos. `CLAUDE.md`'s out-of-scope
list still holds in full: no chat, no automated WhatsApp/push, no stats/results, no payments. Feedback is an
operator tool, not a chat feature; "who's in" is a read of existing availability, not player stats.

## Shaping decisions

| # | Title | Affects |
|---|---|---|
| W1 | Feedback lands in an in-app admin inbox (a `feedback` table + admin screen), not email/SMS/push | S12.1–S12.3 |
| W2 | Feedback is insert-only for users, admin read/resolve; submit context is auto-captured | S12.1, S12.2 |
| W3 | "Who's in" exposes available **names only**; decliner/awaiting identities are never exposed | S13.1, S13.2 |
| W4 | "Who's in" is served by a security-definer RPC, not by relaxing the `event_responses` SELECT policy | S13.1 |
| W5 | "Who's in" surfaces on the event detail screen only, not the calendar day rows | S13.2 |
| W6 | Admin user/membership manager: assign to any team, change role, remove — via an admin RPC | S14.1, S14.2 |
| W7 | Match jersey (Black/Light Blue/White), match-only, shown in-app and in the WhatsApp share | S15.1 |

---

### W1 — Feedback lands in an in-app admin inbox
**Decision** — Submitted feedback is written to a new `feedback` table and read by admins on a dedicated
admin screen (S12.3). No email, SMS or push is provisioned, and adding one for this is out of proportion.
The in-app inbox keeps every report queryable in one place, tied to the reporter and their context, and
reuses the admin god-mode surface that already exists. (Chosen by the owner 2026-09-15.)

**Rejected** — A prefilled WhatsApp-to-you button (feedback ends up unqueryable in your chats, and depends on
the tester hitting send) and Sentry user feedback (needs the Sentry DSN provisioned first, and splits reports
across two tools).

**Fast-follow (planned, not built here)** — A **GitHub-issue mirror**: the table stays the durable, private
source of truth, and a small server piece (a Supabase Edge Function, or a `pg_net` trigger) opens an issue in
a **private** feedback repo for triage. It needs a private repo and a fine-grained token the owner creates;
it does not change this table. Not doable client-only (a public PWA cannot hold a write token), and the repo
is public, so issues there would be public — hence a separate private repo. (Owner chose "table now, mirror
next" on 2026-09-15.)

### W2 — Feedback is insert-only for users; context auto-captured
**Decision** — RLS lets any signed-in user INSERT their own feedback row and read back only their own; only
an admin may read all and update `status` (open → resolved). No user UPDATE/DELETE — a sent report is sent.
At submit time the client captures non-PII context — the current route, the app release SHA (the
`pfc-release` meta, S0.6), the user agent, `display-mode: standalone`, and the viewport — into a `jsonb`
column, so a tester's "this screen looked wrong" is debuggable without a back-and-forth.

### W3 — "Who's in" exposes available names only
**Decision** — A player viewing an event sees the **names of teammates who said Available**, plus **counts**
for the rest ("9 in · 2 out · 3 awaiting"). Individual identities of those who declined or have not answered
are never shown to a player. This is the lightest-privacy option that still works as a "the lads are in"
nudge. Managers keep the full per-name breakdown on their own view (S4.3/S4.4), unchanged. (Chosen by the
owner 2026-09-15.)

### W4 — Served by a security-definer RPC, not a relaxed SELECT policy
**Decision** — Because `CLAUDE.md` makes RLS the enforcement layer ("UI checks are convenience only"),
"who's in" must not be implemented by widening the `event_responses` SELECT policy so players can read all
rows and then hiding decliners in the UI — that would leave who-declined readable over the raw API. Instead a
`SECURITY DEFINER` RPC (`event_availability(p_event_id)`) returns exactly what a player may see: the available
members' names and the three counts, and nothing that identifies a decliner or a non-responder. The
`event_responses` SELECT policy is unchanged; a player still cannot read another player's row directly.

### W5 — Event detail only
**Decision** — "Who's in" appears on the event detail screen (S3.3), beneath the availability control. It is
deliberately not added to the calendar day rows (kept compact per V13) or the Home next-event card in v1.2.0,
to avoid a per-day fan-out of RPC calls and keep the calendar light. Revisit if testers want it at a glance.

### W6 — Admin user & membership manager (repair tool)
**Decision** — An admin gets an **Admin → Users** screen listing every profile with its team memberships and
per-team role, and can **assign a user to any team**, **change their role** (player ↔ manager), and **remove**
them — a god-mode override so an admin can fix state directly when a normal UI path can't. Memberships are
RPC-only (the sole `team_members` policy is SELECT; there is no client write path), so assignment adds one
admin-only security-definer RPC `admin_set_membership(p_team_id, p_user_id, p_role)` — an upsert that sets the
exact role (an admin may downgrade as well as upgrade, unlike the join-link flow, which only upgrades — see
[[the join role-upgrade fix]] / D26). Role changes reuse `set_member_role`; removal reuses `remove_member`.
Reaches inactive teams too (it is a repair tool). No account creation or deletion here — identity is managed
by sign-up and the reset-link flow; this screen only moves memberships. (Owner request 2026-09-15.)

### W7 — Match jersey, in the share and in-app
**Decision** — A match carries an optional **jersey** the manager picks — **Black**, **Light Blue** or
**White** — a new `jersey` enum column on `events`, match-only and nullable, alongside `opponent`/`home_away`/
`meet_at` (V2). Set on the match create/edit form; shown on the event detail; and added to the WhatsApp match
teamsheet as a `Jersey: {colour}` line (a D13/V8 amendment) so players know the kit to bring. Training and
social have no jersey (W7 = matches only, owner's choice). Omitted from the share and the detail when unset.
(Owner request 2026-09-15.)
