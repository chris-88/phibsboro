# v1.4.0 — Decision record (Epic 20: testing feedback)

Epic 20 turns the first round of in-app feedback into a plan. Decisions extend `00-decisions.md`,
`-v1.1.0`, `-v1.2.0`, `-v1.3.0` (and the Y decisions of the subs epic). Prefix **Z**. Items marked
**OPEN** need Chris to confirm before that story is built.

| # | Title | Affects |
|---|---|---|
| Z1 | Semantic colour only on *status*, grey stays the chrome | S20.2 |
| Z2 | Subs colour by paid-up vs owing; no amount band yet (OPEN) | S20.2 |
| Z3 | Player name is edited on the profile; who may edit (OPEN) | S20.7 |
| Z4 | WhatsApp format refresh needs the target wording (OPEN) | S20.8 |
| Z5 | Injury status: who sets it + where it surfaces (OPEN) | S20.6 |

---

### Z1 — Semantic colour only on status, grey stays the chrome
Epic 11 deliberately moved the accent from blue to grey (#4d4d4d) for a calm, brand-neutral chrome, and
team colours are the only strong colour on the calendar. The feedback (yes/no, paid/unpaid, event type,
role) asks for **meaningful** colour. Resolve the tension: **chrome stays grey**; colour is added only to
**status signifiers** — the availability Yes/No, the paid-up/owing badge, an injured flag, the event-type
chip and the role tag. One small token set (success green, danger red, info blue, warning amber) defined
once in the theme, light + dark, so nothing is hardcoded (S0.2). This keeps the app calm but makes state
legible at a glance — the thing the testers are actually asking for.

### Z2 — Subs colour by paid-up vs owing; no amount band yet — OPEN
#1c wants "paid up green, over €250 orange". Paid-up-vs-owing is clear and ships (green when outstanding
is 0, amber/red while owing). The **€250 band** implies a rule ("owes more than half"? "a big balance"?)
that isn't defined. **Proposed:** ship the two-state colour now; hold the amount band until there's a
real rule. Chris to confirm whether €250 is a genuine threshold.

### Z3 — Player name is edited on the profile; who may edit — OPEN
The app stores one `profiles.name` per person; the team sheet, roster and shares all read it. #7 wants a
manager to fix a wrong name. **Proposed:** a security-definer RPC that sets `profiles.name` for a member,
callable by an **admin, or a manager of a team the person is on** (mirrors the on-behalf pattern, S18.1),
audited. It edits the person's single name, not a per-team alias (a per-team display name is more data and
wasn't asked for). Chris to confirm: admin-only, or managers too?

### Z4 — WhatsApp format refresh needs the target wording — OPEN
#6 ("update the WhatsApp messages to a better format") is not actionable without the target. The current
formats are fixed byte-for-byte (D13 + the S9.3 teamsheet). Parked until Chris supplies the desired
wording, then it's a focused edit to `buildShareMessage` / `buildMatchShareMessage` + their byte tests.

### Z5 — Injury status: who sets it + where it surfaces — OPEN
#4 wants players marked injured (by themselves or a manager) with an expected return date and updates.
**Proposed shape:** an `injury` on the player (status + expected-return + a note), set by the **player
themselves or a manager of their team**; shown on the profile, on the roster/squad picker as an "Injured"
flag, and optionally excluded from the availability "awaiting" chase. Confirm the scope — is a single
current-injury record enough, or do they want a history?
