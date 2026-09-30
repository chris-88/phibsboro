# v1.4.0 — Decision record (Epic 20: testing feedback)

Epic 20 turns the first round of in-app feedback into a plan. **Scoped to the items Chris raised** — the
visual-polish and who's-in ideas from Aaron are dropped from this epic (see README). Decisions extend
`00-decisions.md`, `-v1.1.0`, `-v1.2.0`, `-v1.3.0` (and the Y decisions of the subs epic). Prefix **Z**.
Items marked **OPEN** need Chris to confirm before that story is built.

| # | Title | Affects |
|---|---|---|
| Z1 | Player name is edited on the profile; who may edit (OPEN) | S20.2 |
| Z2 | Injury status: who sets it + where it surfaces (OPEN) | S20.3 |
| Z3 | WhatsApp format refresh needs the target wording (OPEN) | S20.4 |

The team-switcher fix (S20.1) needs no decision — it's a bug.

---

### Z1 — Player name is edited on the profile; who may edit — OPEN
The app stores one `profiles.name` per person; the team sheet, roster and shares all read it. #7 wants a
manager to fix a wrong name. **Proposed:** a security-definer RPC that sets `profiles.name` for a member,
callable by an **admin, or a manager of a team the person is on** (mirrors the on-behalf pattern, S18.1),
audited. It edits the person's single name, not a per-team alias (a per-team display name is more data and
wasn't asked for). Chris to confirm: admin-only, or managers too?

### Z2 — Injury status: who sets it + where it surfaces — OPEN
#4 wants players marked injured (by themselves or a manager) with an expected return date and updates.
**Proposed shape:** an `injury` on the player (status + expected-return + a note), set by the **player
themselves or a manager of their team**; shown on the profile, on the roster/squad picker as an "Injured"
flag, and optionally excluded from the availability "awaiting" chase. Confirm the scope — is a single
current-injury record enough, or do they want a history? And is it purely informational for v1, or does it
affect availability / squad selection?

### Z3 — WhatsApp format refresh needs the target wording — OPEN
#6 ("update the WhatsApp messages to a better format") is not actionable without the target. The current
formats are fixed byte-for-byte (D13 + the S9.3 teamsheet + the Epic 19 subs nudge). Parked until Chris
supplies the desired wording, then it's a focused edit to `buildShareMessage` / `buildReminderMessage` /
`buildMatchShareMessage` / `buildSubsReminderMessage` + their byte tests.
