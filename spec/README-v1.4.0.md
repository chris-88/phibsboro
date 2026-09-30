# v1.4.0 — Epic 20: Testing feedback (round 1)

The management team have been testing since the club link went out, and the in-app **feedback inbox**
(Epic 12) has collected the first round. This epic takes **the items Chris raised** into a plan — one
story per PR, RLS stays green, four UI states, `typecheck` + `lint` + tests clean per story.

Four items: a **real bug** that blocks the second team for multi-team managers (top priority), and three
**small features** — manager-editable names, injury status, and a WhatsApp format refresh. A couple need a
decision from Chris first — flagged in `00-decisions-v1.4.0.md` (prefix **Z**) and per story.

Decisions extend `00-decisions.md` and `-v1.1.0`…`-v1.3.0`. This deliberately keeps the "keep it boring"
ethos: every item earns its place against the core journey.

## The feedback, mapped

| # | Reporter | Kind | Feedback (verbatim, trimmed) | → Story |
|---|---|---|---|---|
| 5 | Chris | bug | "dual managers being able to switch between teams with the dropdown on squad pages and other as needed" | **S20.1** |
| 7 | Chris | feature | managers can correct player names so the team sheet reads right | **S20.2** |
| 4 | Chris | feature | injury status — marked by self or manager, with an expected return date | **S20.3** |
| 6 | Chris | chore | update the WhatsApp messages to a better format | **S20.4** |

The same team-switch bug was independently reported by Aaron (#2, "can't swap from the first team to the
second team") and Sean (#3, "can't drop down PCF II scheduling"); they corroborate S20.1.

## Dropped from this epic (Aaron's items)

Per Chris, Aaron's feedback is **not** in v1.4.0: the semantic-colour pass (yes/no, role, event-type, subs
tags), the Eagle crest in the header, bold minutes on the profile stats, and the who's-in name lists. The
who's-in idea still has a home in the Epic 13 spec if it's picked up later. Nothing here is deleted from the
feedback inbox — these items stay **open** for a future round.

## Build order

| # | ID | Story | Source | Size | Priority | Status |
|---|---|---|---|---|---|---|
| 1 | S20.1 | Fix multi-team manager team switching | #5 (#2, #3) | M | **P0 (blocker)** | ☑ done, live |
| 2 | S20.2 | Managers correct a player's name | #7 | S | P1 | ☐ |
| 3 | S20.3 | Injury status + expected return | #4 | M | P2 | ☐ |
| 4 | S20.4 | WhatsApp message format refresh | #6 | S | P2 (needs detail) | ☐ |

Order rationale: the **team-switcher bug (S20.1)** is first — it locks a multi-team manager out of their
second team and three people hit it. **Manager-editable names (S20.2)** is the smallest and unblocked once
Z1 is confirmed. **Injury (S20.3)** needs the Z2 shape. **S20.4** waits on Chris's target WhatsApp format.

## Decisions to confirm (see 00-decisions-v1.4.0.md)
- **Z1** — Player name editing (S20.2): admin-only, or a manager for their own team too? Proposed: a
  security-definer RPC editing `profiles.name`, callable by an admin or a manager of a team the person is
  on, audited.
- **Z2** — Injury status (S20.3): who sets it (self + manager?), single current record or a history, and
  does it affect availability / squad selection or is it purely informational for v1?
- **Z3** — WhatsApp format (S20.4): needs the target wording. Parked until Chris supplies it.

## Not in v1.4.0 (flagged)
Still out: Aaron's polish/who's-in items (above), the feedback→GitHub-issue mirror (needs a private repo +
token), automated WhatsApp sending, push, payments processing. Avatar photo upload stays blocked on the
Auth HS256 key flip (owner action).
