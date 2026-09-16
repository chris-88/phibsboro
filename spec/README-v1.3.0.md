# v1.3.0 — build plan

**Stats & match data.** One epic (17) that builds out the sketched IA: rename Manage → Schedule (with a Past
view), round out the Squad tab, collect match stats live in-game, and turn the disabled Stats tab into a real
role-aware Attendance + Performance view. Brings player stats and match results into scope (X1). Same
conventions: one story per PR, build in order, RLS stays green, four UI states. Decisions in
`00-decisions-v1.3.0.md`; data model in `data-model-v1.3.0.md`.

**New in v1.3.0, at a glance:** Schedule (Upcoming · Past · Create) · Squad (Selection · Game Stats ·
Members) · live in-game stat collection (goals/assists/cards/minutes, MOTM, score) · Stats tab with
Attendance and Performance, shown by role.

## Build order

| # | ID | Story | Depends on | Size | Status |
|---|---|---|---|---|---|
| 1 | S17.1 | Schedule: rename Manage, add Past | S4.1, S4.3 | S | ✓ |
| 2 | S17.3 | Match-stats data model + RLS + `events` MOTM/score | S1.4, S9.1 | M | ✓ |
| 3 | S17.4 | Game Stats: live collection + edit (Squad tab) | S17.3, S9.2, S10.3 | L | ☐ |
| 4 | S17.2 | Squad tab: Selection · Game Stats · Members | S17.4 | S | ☐ |
| 5 | S17.5 | Attendance stats (RPC + screen) | S1.4, S3.5 data | M | ✓ |
| 6 | S17.6 | Performance stats (RPC + screen) | S17.3 | M | ✓ |
| 7 | S17.7 | Stats tab: enable, role-aware Attendance + Performance | S17.5, S17.6 | M | ✓ |

Order rationale: Schedule is a quick standalone win. The match-stats **model (S17.3)** underpins both the
collection screen (S17.4) and Performance (S17.6), so it lands early. Attendance (S17.5) is independent (data
already exists) and can go in parallel. The Stats tab (S17.7) wires the two stats screens once both exist.

## What the epic delivers
- **Schedule:** the manager's event hub, renamed, with Upcoming / Past over the team's events and Create.
- **Squad:** one tab for the three manager jobs — pick the side (Selection), run the game (Game Stats), manage
  people (Members).
- **Game Stats:** on a match, a live per-player tally — tap a goal/assist/card as it happens — plus minutes,
  man of the match and the final score; editable after the whistle.
- **Stats:** a real tab at last. A player sees their own attendance and performance; a manager sees the whole
  squad — who turns up, who scores, top of each list.

## Not in v1.3.0 (flagged)
- Automated stats (feeds, scraping) — everything is manager-entered.
- Per-player public profiles / teammate stat pages (ties to the view-others epic).
- Advanced metrics (ratings, shots, passes) — core football stats only (X4).
