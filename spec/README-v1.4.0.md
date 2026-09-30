# v1.4.0 — Epic 20: Testing feedback (round 1)

The management team have been testing since the club link went out, and the in-app **feedback inbox**
(Epic 12) has collected the first round. This epic **rolls all seven feedback items into a plan** — one
epic, built in order, same conventions: one story per PR, RLS stays green, four UI states, `typecheck`
+ `lint` + tests clean per story.

Mix of three kinds: a **real bug** that blocks the second team for multi-team managers (top priority), a
bundle of **visual polish** (semantic colours, the crest, stat emphasis), and three **small features**
(who's-in names, injury status, manager-editable names) plus a WhatsApp format refresh. A couple need a
decision from Chris first — flagged in `00-decisions-v1.4.0.md` (prefix **Z**) and per story.

Decisions extend `00-decisions.md` and `-v1.1.0`…`-v1.3.0`. This deliberately keeps the "keep it boring"
ethos: every item earns its place against the core journey.

## The feedback, mapped

| # | Reporter | Kind | Feedback (verbatim, trimmed) | → Story |
|---|---|---|---|---|
| 2 | Aaron | bug | "on the squad page can't seem to swap from the first team to the second team" | **S20.1** |
| 3 | Sean | bug | "Can't drop down PCF II scheduling training/matches" | **S20.1** |
| 5 | Chris | bug | "dual managers being able to switch between teams with the dropdown on squad pages and other as needed" | **S20.1** |
| 1d | Aaron | polish | yes→green / no→red availability buttons | **S20.2** |
| 1a | Aaron | polish | player tag green, coach/manager tag blue | **S20.2** |
| 1f | Aaron | polish | training tag on Home → blue | **S20.2** |
| 1c | Aaron | polish | paid-up tag green, payments over €250 orange | **S20.2** |
| 1g | Aaron | polish | the Eagle crest top-centre in the bar | **S20.3** |
| 1b | Aaron | polish | minutes in **bold** on the player's profile (not everyone gets a goal/assist) | **S20.4** |
| 1e | Aaron | feature | see who's going to training / who isn't / who's left to answer | **S20.5** |
| 4 | Chris | feature | injury status — marked by self or manager, with an expected return date | **S20.6** |
| 7 | Chris | feature | managers can correct player names so the team sheet reads right | **S20.7** |
| 6 | Chris | chore | update the WhatsApp messages to a better format | **S20.8** |

## Build order

| # | ID | Story | Source | Size | Priority | Status |
|---|---|---|---|---|---|---|
| 1 | S20.1 | Fix multi-team manager team switching | #2, #3, #5 | M | **P0 (blocker)** | ☐ |
| 2 | S20.5 | Who's in: available / unavailable / awaiting names | #1e | M | P1 | ☐ |
| 3 | S20.2 | Semantic colours (availability, role, event-type, subs tags) | #1a,c,d,f | M | P1 | ☐ |
| 4 | S20.7 | Managers correct a player's name | #7 | S | P2 | ☐ |
| 5 | S20.3 | Club crest in the header | #1g | S | P2 | ☐ |
| 6 | S20.6 | Injury status + expected return | #4 | M | P2 | ☐ |
| 7 | S20.4 | Emphasise minutes on the player's stats | #1b | S | P3 | ☐ |
| 8 | S20.8 | WhatsApp message format refresh | #6 | S | P3 (needs detail) | ☐ |

Order rationale: the **team-switcher bug (S20.1)** is first — three people hit it and it locks a
multi-team manager out of their second team. **Who's-in (S20.5)** is the most-requested feature and
matches the existing Epic 13 spec. The **colour pass (S20.2)** is one coherent design change, so it's
grouped rather than dribbled across stories. The rest are independent; **S20.8** waits on Chris's target
format.

## Decisions to confirm (see 00-decisions-v1.4.0.md)
- **Z1** — Semantic colours vs the deliberate grey accent (the app went blue→grey in Epic 11). Adding
  green/red/blue/orange for *status* (paid/unpaid, yes/no, injured, event type) is the ask; proposed:
  keep the grey *chrome*, add semantic colour only to *status* signifiers. Confirm the palette.
- **Z2** — The €250 "orange" threshold (#1c): is €250 a real club figure, or shorthand for "still owes a
  lot"? Proposed: colour purely by paid-up vs owing; hold the amount-band until there's a rule.
- **Z3** — Player name editing (S20.7): a manager edits the *display name on the team* vs the person's
  real profile name. Proposed: an admin-only or manager-for-their-team RPC that edits `profiles.name`
  (the single name the team sheet reads), audited. Confirm who may edit.
- **Z4** — WhatsApp format (S20.8): needs the target wording. Parked until Chris supplies it.
- **Z5** — Injury status (S20.6): who can set it (self + manager?), and does it surface on availability
  / the squad picker (e.g. an "Injured" flag)? Proposed below in the story.

## Not in v1.4.0 (flagged)
Still out: the feedback→GitHub-issue mirror (needs a private repo + token), automated WhatsApp sending,
push, payments processing. Avatar photo upload stays blocked on the Auth HS256 key flip (owner action).
