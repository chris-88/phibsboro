# v1.1.0 — build plan

v1.0.0 (the 43 MVP stories) is the base. v1.1.0 adds richer events, matchday squad selection, and a calendar
Home. Same conventions as v1.0.0: one story per PR, build in the order below, a story isn't started until
its dependencies pass, RLS stays green (S1.4 grows). Where v1.1.0 changes a v1.0.0 rule, `00-decisions-v1.1.0.md`
records it and the story cites it.

**New in v1.1.0, at a glance:** Social event type · match opponent/home-away with a generated title · Meet +
Kick-off times · Google-Maps locations defaulting home to Bogies · a matchday squad (pick from available,
numbers, captain) · the club's real numbered-teamsheet WhatsApp share · team colours · a calendar Home screen
· a manager Squad tab.

## Build order

| # | ID | Story | Epic | Depends on | Size | Status |
|---|---|---|---|---|---|---|
| 1 | S8.1 | Social event type | 8 Events | S4.1 | S | ✓ |
| 2 | S8.2 | Match opponent + home/away + generated title | 8 Events | S8.1 | M | ✓ |
| 3 | S8.3 | Meet + Kick-off times | 8 Events | S8.2 | S | ✓ |
| 4 | S8.4 | Google-Maps location + Bogies default | 8 Events | S8.2 | S |
| 5 | S10.3 | Manager Squad tab (matchday + members hub) | 10 Calendar/nav | S6.4, S2.9, S8.2 | M |
| 6 | S9.1 | Squad data model + RLS (`event_squad`) | 9 Squad | S8.2, S1.4 | M |
| 7 | S9.2 | Squad selection (in the Squad tab, and from the match) | 9 Squad | S9.1, S10.3, S4.3 | M |
| 8 | S9.3 | Match share rewrite (numbered squad) | 9 Squad | S9.2, S8.3, S8.4, S5.2 | M |
| 9 | S10.1 | Team colours | 10 Calendar/nav | S6.1 | S |
| 10 | S10.2 | Calendar Home screen | 10 Calendar/nav | S10.1, S3.1–S3.4, S8.x | L |


Epic 8 is the foundation (the event model everything else reads). The **Squad tab (S10.3) is built before
Epic 9** because the squad picker lives inside it (V12): the tab hosts upcoming matches (pick a squad) on
top and the roster (reset/remove/role) below. Epic 9 then adds the data model, the picker (mounted in the
tab and linked from the match view) and the teamsheet share. Team colours + the calendar Home (S10.1, S10.2)
come last — independent of the squad work.

## What each epic delivers
- **Epic 8 — Richer event model:** create a Social event; enter an opponent and home/away and the title
  writes itself; set a Meet and a Kick-off; paste a maps link or default home to Bogies.
- **Epic 9 — Matchday squad:** a manager picks the squad from those who said they're available, numbers them
  and names a captain, and shares the numbered teamsheet to WhatsApp in the club's exact format.
- **Epic 10 — Calendar and navigation:** each team has a colour; the player Home becomes a month calendar with
  coloured event dots and a tap-a-day list; managers get a Squad tab straight to the member actions.

## Documents
- `00-decisions-v1.1.0.md` — the v1.1.0 decisions (V1–V11) and open questions; extends/overrides the v1.0.0 record.
- `data-model-v1.1.0.md` — the schema changes (events columns, `teams.colour`, the `event_squad` table).
- `stories/` — the ten story files.

## Definition of done (unchanged from v1.0.0)
Acceptance criteria met; `typecheck`/`lint` clean; the story's tests pass in CI; four UI states on every
screen touched; `test:rls` still green (now with the squad coverage).
