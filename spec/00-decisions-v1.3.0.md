# v1.3.0 — Decision record

v1.3.0 is **Stats & match data** — one epic (Epic 17) that builds out the manager-facing IA Chris
sketched: a renamed Schedule tab, a fuller Squad tab, live in-game stat collection, and a real Stats
tab. It deliberately brings **player stats and match results into scope**, overriding `CLAUDE.md`'s
v1.0.0 "no stats/results" line the way V1 brought team selection in (owner-approved 2026-09-16). The
"keep it boring" ethos still holds: every stat is a read of data a manager actually enters, no third
-party feeds, no scraping.

Decisions extend `00-decisions.md`, `-v1.1.0`, `-v1.2.0`. Prefix **X**.

## Shaping decisions

| # | Title | Affects |
|---|---|---|
| X1 | v1.3.0 brings player stats + match results into scope; one epic, the whole tree | all |
| X2 | The **Manage** tab is renamed **Schedule** = Upcoming · Past · Create (route stays `/manage`) | S17.1 |
| X3 | The **Squad** tab is Selection · Game Stats · Members (Selection + Members already exist) | S17.2, S17.4 |
| X4 | Match stats are a new `match_stats` table, one row per player per match; MOTM + final score on the event | S17.3 |
| X5 | Collection is **live in-game** — per-player counters that write as you tap — and editable post-game | S17.4 |
| X6 | Stats are **role-aware**: a player sees their own, a manager/admin sees the whole squad | S17.5–S17.7 |
| X7 | **Attendance** stats derive from existing `attendance`/`event_responses` — no new data to collect | S17.5 |
| X8 | **Performance** stats aggregate `match_stats`; RLS gives a player only their own rows, a manager all | S17.6 |

---

### X1 — Stats & match results enter scope for v1.3.0
`CLAUDE.md` lists results and player stats as out of scope — that was the v1.0.0 MVP line. Chris (owner)
brings them in for v1.3.0, built as one epic across the sketched tree (Schedule, Squad, Stats). Record this
as an override in the out-of-scope note when the epic starts, the way V1 handled team selection.

### X2 — Manage → Schedule
The **Manage** bottom-nav tab and its screen heading become **Schedule**. The screen gains an **Upcoming /
Past** split (a segmented toggle) over the team's events, with **Create** (the existing New-event flow) still
on it. The internal route stays `/manage` (renaming it churns many tests for no user-visible gain); the
label and headings are what the user sees. Past events are the same read, filtered to `starts_at < now`.

### X3 — Squad tab: Selection · Game Stats · Members
The Squad tab already hosts **Selection** (the matchday squad picker, S9.2) and **Members** (S6.4). It gains
**Game Stats**: from a match, open the collection screen (S17.4). No new picker or member work — this
decision is about surfacing the three clearly and adding the Game Stats entry point per match.

### X4 — The `match_stats` model
One row per (event, player): `goals`, `assists`, `yellow_cards`, `red_card`, `minutes`. **MOTM** is one
player per match, stored as `events.motm_user_id`. The **final score** is `events.score_us` / `score_them`
(match-only, nullable). Team goals-for is derivable from player goals but the score is stored explicitly so a
match with own-goals/unattributed goals still reads right. See [data-model-v1.3.0.md](data-model-v1.3.0.md).

### X5 — Live in-game collection, editable after
The collection screen (S17.4) lists the **selected squad** (`event_squad`) with per-player **+/- counters**
for goals/assists/yellows, a red toggle, and minutes; a MOTM picker and the score at the top. Each tap is an
optimistic upsert (D48) so it works on the sideline; the same screen edits an old match's rows. Managers of
the team (or admin) only.

### X6 — Role-aware stats
The **Stats** tab (enabled, S17.7) shows a player **their own** attendance and performance; a manager/admin
sees the **whole squad** (leaderboards, per-player, drill-in). One tab, the view widens by role. This is the
audience owner chose; the RLS enforces it (X8), never just the UI (the who's-in principle, W4).

### X7 — Attendance stats from existing data
No collection needed: `attendance` (attended/absent the manager recorded) + `event_responses` (availability)
+ `team_members` + past `events` already hold it. A security-definer RPC computes per-player figures —
games attended / played, training attended, attendance %, availability-response rate — scoped by role.

### X8 — Performance stats from `match_stats`
An RPC aggregates a player's `match_stats` into appearances, goals, assists, cards, minutes and MOTM count,
and a manager's into the squad leaderboard. RLS on `match_stats`: **write** = team manager/admin; **read** =
team manager/admin OR the player's own rows — so a player's Performance view is their own numbers, a
manager's is everyone's, enforced in the DB.
