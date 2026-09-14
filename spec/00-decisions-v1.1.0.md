# v1.1.0 — Decision record

v1.0.0 was the MVP defined by `CLAUDE.md`; its "Out of scope" list was the MVP boundary. v1.1.0 is the next
version and deliberately brings some of those items into scope. Decisions here extend, and where noted
override, the v1.0.0 decisions in `00-decisions.md`. When v1.1.0 starts, `CLAUDE.md`'s out-of-scope list is
relabelled as v1.0.0's and a "## v1.1.0 scope" note is added; nothing here is a scope violation.

## Blocker / shaping decisions

| # | Title | Affects |
|---|---|---|
| V1 | Team selection enters scope for v1.1.0 | S9.1–S9.3, CLAUDE.md |
| V2 | `events` gains match fields, kept nullable and match-only | S8.1–S8.4, data-model |
| V3 | Match title is derived from opponent + home/away, not typed | S8.2, S3.3, S5.1 |
| V4 | `starts_at` remains kick-off; `meet_at` is a separate, optional, match-only column | S8.3, S3.4 |
| V5 | Location may be a plain string or a URL; home matches default to Bogies | S8.4 |
| V6 | The matchday squad is a new table `event_squad`, distinct from responses and attendance | S9.1 |
| V7 | The squad pool is the available responders only | S9.2 |
| V8 | The match share message is rewritten to the club's real format (D13 amended) | S9.3, S5.1, S5.3 |
| V9 | `teams` gains a `colour`, admin-editable, used by the calendar | S10.1, S10.2 |
| V10 | The Home screen becomes a calendar; the upcoming list is replaced | S10.2 (amends S3.1, S3.2) |
| V11 | Managers get a Squad tab — a matchday + members hub | S10.3 |
| V12 | Squad selection lives in the Squad tab (built before Epic 9), also reachable from the match | S10.3, S9.2 |

---

### V1 — Team selection enters scope for v1.1.0
**Decision** — `CLAUDE.md` lists "team selection" as out of scope. That was the v1.0.0 MVP boundary. For
v1.1.0 the owner has brought matchday squad selection into scope (Epic 9). Relabel the brief's out-of-scope
list as v1.0.0's and note the v1.1.0 additions. This is not a violation; it is the next version.

### V2 — `events` match fields are nullable and match-only
**Decision** — The new match columns (`opponent`, `home_away`, `meet_at`) are all nullable and meaningful
only when `type = 'match'`. Training and social events leave them null. No column is required at the DB
level; the form enforces per-type requirements. Existing rows are unaffected (all null). Keeps the
migration additive and backward compatible.

### V3 — Match title is derived, not typed
**Decision** — For a match the manager enters the **opponent**; the title is generated: home →
`{team name} v {opponent}`, away → `{opponent} v {team name}` (home team first, football convention). The
generated title is stored in `events.title` (so existing readers, the share and the calendar keep working
unchanged) AND `opponent`/`home_away` are stored so the title can be regenerated and the share can render
"Home Game"/"Away". Training and social keep the v1.0.0 behaviour (typed title, defaulted by type). The
share uses "vs" per the club's message; the on-screen title uses "v" — one generator, a variant flag.

### V4 — Two times: kick-off and meet
**Decision** — `starts_at` stays the kick-off / start time and keeps driving the respond-until-start cutoff
(S3.4, D12) unchanged. Add `meet_at timestamptz` null — the meet/arrival time, earlier than kick-off,
shown only on the match form (Chris's choice: matches only). Both compose Dublin wall-time to UTC through
the time helper. A check constraint keeps `meet_at < starts_at` when both are set.

### V5 — Location string or URL, Bogies default
**Decision** — `events.location` stays free text but may hold a URL (a Google Maps link). The event detail
and the day list render it as a tappable link when it looks like a URL, plain text otherwise. A home match
(home_away = 'home') defaults the location to the club home ground: name **"Bogies"**, link
`https://maps.app.goo.gl/SD1NJmBYwLqz8Z7M6`. Store the maps link in `location` and show "Bogies" as the
label; a small `HOME_VENUE` constant holds both. Away matches paste their own link.

### V6 — `event_squad` table
**Decision** — The matchday squad is its own table, distinct from `event_responses` (availability) and
`attendance` (who turned up):
`event_squad(event_id, user_id, shirt_number int, is_captain bool default false, recorded_by, updated_at)`,
PK `(event_id, user_id)`, unique `(event_id, shirt_number)`, unique partial one-captain-per-event. Only
managers of the event's team (and admins) write; team members read their team's. Squad numbers 1–20.

### V7 — Squad pool is available responders
**Decision** — The selection screen offers only players with an `event_responses.response = 'available'`
row for that event (Chris's choice). A manager cannot number someone who has not said they are available.
If a numbered player later changes to unavailable, they stay in the squad but are flagged; the manager
removes or renumbers them.

### V8 — Match share rewrite (amends D13)
**Decision** — The match share message is rewritten to the club's real format, replacing D13's match
variant:
```
{team} vs {opponent}
KO: {kickoff HH:MM} | Meet: {meet HH:MM}
Home Game: Bogies            ← or: Away: {location}

Squad:
 1. {name}
 2. {name}
 3. {name} (C)
 ...
20. {name}
```
When no squad is selected yet, the "Squad:" block is omitted (the manager shares the fixture first, picks
the squad later, shares again). Times via formatEventTime, a new 'time' variant (HH:MM, Dublin). Training
and social keep the D13 v1.0.0 format. The reminder variant (S5.3) is unchanged in shape.

### V9 — Team colour
**Decision** — `teams` gains `colour text not null default '#...'` (a hex from the design palette). Seeded
distinct for Firsts/Seconds. Editable by an admin on the team screen (S6.1 area) via a small swatch picker
constrained to an accessible palette. Used as the calendar dot colour (S10.2).

### V10 — Calendar Home (amends S3.1/S3.2)
**Decision** — The player Home screen becomes: a condensed next-event card on top (keeps the Yes/No), then
a month calendar with a team-coloured dot per event per day, then the selected day's events below. The
v1.0.0 chronological upcoming list (S3.2) is replaced by the calendar + selected-day list. Cancelled events
show a hollow/grey dot and struck-through in the day list, consistent with existing cancelled styling.

### V11 — Manager Squad tab, a matchday + members hub
**Decision** — `navItemsForRole` gains a **Squad** item for managers: Home | History | Manage | Squad
(admins keep Admin — no 5th tab, Q4). The Squad tab is the manager's squad hub with two sections:
**Matchday** on top (the managed team's upcoming matches, each opening the squad picker) and **Members**
below (the existing S6.4 roster: reset / remove / change-role). Reuses the active-team selector for a
manager of more than one team. Fixes the v1.0.0 gap where the member/reset actions were only reachable via
an event, and gives the matchday squad a home.

### V12 — Squad selection lives in the Squad tab, built before Epic 9
**Decision** — Owner's call (2026-09-14): the matchday squad picker (S9.2) lives inside the Squad tab's
Matchday section, and is also reachable by a "Pick squad" link on the match manager view (S4.3) — two entry
points, one editor at `/squad/event/:id`. So the Squad tab (S10.3) is built **before** Epic 9's picker, and
the v1.1.0 build order is S8.x → S10.3 → S9.1 → S9.2 → S9.3 → S10.1 → S10.2. S10.3 ships the tab shell + the
members section + the matchday match-list with entry points; S9.1/S9.2 add the data model and the picker;
S9.3 the share. Rationale: you pick and share a squad as one squad-focused task, so it belongs in the Squad
tab, not buried on the event screen.

## Open questions (v1.1.0)
| # | Question | Proposed default |
|---|---|---|
| Q1 | Vice-captain as well as captain? | No — captain only in v1.1.0, matching the club message's single (C). |
| Q2 | Squad size hard cap? | 20 (matches the club message and the numbering). Configurable later. |
| Q3 | Team short name for the share ("PCF II")? | Use the full team name for now; add a `short_name` only if the club asks. |
| Q4 | Admins get the Squad tab too, or 5 tabs? | Managers get Squad; an admin keeps Admin and reaches members there — avoid 5 tabs. Revisit if awkward. |
