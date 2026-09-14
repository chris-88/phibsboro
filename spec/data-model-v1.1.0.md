# v1.1.0 — Data-model changes

Additive to `spec/data-model.md`. All new columns are nullable or defaulted, so the migrations run clean on
the live database and existing rows are unaffected.

## `events` — new columns (Epic 8)

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `opponent` | text | yes | — | Match only. The other team's name; the title is derived from it (V3). |
| `home_away` | `home_away` enum (`'home'`\|`'away'`) | yes | — | Match only. Null for training/social. |
| `meet_at` | timestamptz | yes | — | Match only. Meet/arrival time, earlier than `starts_at` (V4). |

- New enum: `create type public.home_away as enum ('home','away');`
- `event_type` enum gains a value: `alter type public.event_type add value 'social';` (V2/S8.1). Note:
  `add value` cannot run inside the same transaction that then uses it — put it in its own migration.
- Check: `meet_at is null or starts_at is null or meet_at < starts_at`.
- Check (belt and braces): `home_away is null or type = 'match'` and `opponent is null or type = 'match'`.
- No index changes; existing `events(team_id, starts_at)` still serves the calendar month query.
- RLS unchanged — the new columns live on `events`, already policied (S1.3). Regenerate
  `src/lib/database.types.ts` after each migration.

## `teams` — new column (Epic 10)

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `colour` | text | no | `'#1e40af'` | Hex, from the accessible palette (V9). Admin-editable. |

- Check: `colour ~ '^#[0-9a-fA-F]{6}$'`.
- Seed: Firsts and Seconds get distinct accessible defaults.
- RLS: covered by the existing teams policies; an admin update already permitted (S1.3). The colour picker
  writes through the existing team update hook.

## `event_squad` — new table (Epic 9)

The matchday squad, distinct from availability (`event_responses`) and attendance (`attendance`).

| Column | Type | Null | Notes |
|---|---|---|---|
| `event_id` | uuid | no | FK → events(id) on delete cascade |
| `user_id` | uuid | no | FK → profiles(id) on delete cascade |
| `shirt_number` | int | no | 1–20 (check) |
| `is_captain` | boolean | no | default false |
| `recorded_by` | uuid | no | FK → profiles(id); the manager who set it |
| `updated_at` | timestamptz | no | default now() |

- PK `(event_id, user_id)`.
- Unique `(event_id, shirt_number)` — no two players share a number in a match.
- Unique partial `(event_id) where is_captain` — at most one captain per event.
- Check `shirt_number between 1 and 20`.
- Index `event_squad(event_id)` for the per-event read.

### RLS (Epic 9, S9.1)
| Role | select | insert/update/delete |
|---|---|---|
| player | own team's rows | — |
| manager | own team's rows | only teams they manage |
| admin | all | all |
| anon | — | — |

- Writes go through the manager-facing mutations under `src/api/`, gated by `is_team_manager(team_id)` /
  `is_admin()` exactly like attendance (S4.5). The manager-only write is enforced by policy, not the UI.
- The pool constraint (V7 — only available players) is enforced in the write path / an RPC that checks an
  `event_responses.response = 'available'` row exists for `(event_id, user_id)`; document whether it is a
  policy `with check` subquery or a security-definer RPC in S9.1.

## Access-matrix additions
Add `event_squad` to `spec/data-model.md`'s access matrix as above, and the four new columns to the `events`
row (same policies as the rest of the row).
