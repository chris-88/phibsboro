# v1.3.0 — Data-model changes

Additive. One new table (`match_stats`), three new `events` columns, and read RPCs for the two stats views.

## `match_stats` — new table (Epic 17, X4/X5)

One row per player per match; the manager fills it live and can edit it after.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `event_id` | uuid | no | — | FK → `events(id)` on delete cascade |
| `user_id` | uuid | no | — | FK → `profiles(id)` on delete cascade |
| `goals` | int | no | 0 | check `>= 0` |
| `assists` | int | no | 0 | check `>= 0` |
| `yellow_cards` | int | no | 0 | check `between 0 and 2` |
| `red_card` | boolean | no | false | |
| `minutes` | int | yes | — | check `is null or between 0 and 200` (ET allowed) |
| `recorded_by` | uuid | yes | — | FK → `profiles(id)`; who last wrote it |
| `updated_at` | timestamptz | no | `now()` | trigger-stamped |

- PK `(event_id, user_id)`. Index `match_stats(user_id)` for the per-player Performance aggregate.
- **RLS** (X6/X8): enable RLS.
  - **Insert/Update/Delete** — `is_team_manager(public.event_team_id(event_id)) or public.is_admin()`.
  - **Select** — the above **OR** `user_id = auth.uid()` (a player reads only their own rows).
- Written via an upsert from the collection screen (optimistic, D48), the same pattern as `attendance`.

## `events` — new columns (Epic 17, X4)

| Column | Type | Null | Notes |
|---|---|---|---|
| `motm_user_id` | uuid | yes | FK → `profiles(id)`; man of the match, one per match. |
| `score_us` | int | yes | Final goals for; match-only. Check `is null or >= 0`. |
| `score_them` | int | yes | Final goals against; match-only. Check `is null or >= 0`. |

- Belt-and-braces checks: all three `is null or type = 'match'`. RLS unchanged (columns on `events`).
- Regenerate `src/lib/database.types.ts` after each migration.

## `attendance_stats` — new RPC (Epic 17, X7)

```sql
create function public.attendance_stats(p_team_id uuid)
returns table (
  user_id uuid, name text,
  games_total int, games_attended int,
  training_total int, training_attended int,
  responded int, invited int            -- availability response rate = responded / invited
)
language sql security definer set search_path = ''
```
- Role-aware: `is_team_manager(p_team_id) or is_admin()` → every squad member's row; otherwise → only the
  caller's own row (a player). A non-member gets nothing. Counts over **past** events of the team; games =
  `type = 'match'`, training = `type in ('training','social')`.

## `performance_stats` — new RPC (Epic 17, X8)

```sql
create function public.performance_stats(p_team_id uuid)
returns table (
  user_id uuid, name text,
  appearances int, goals int, assists int,
  yellow_cards int, red_cards int, minutes int, motm int
)
language sql security definer set search_path = ''
```
- Same role scoping as `attendance_stats`. Aggregates `match_stats` (and `events.motm_user_id` for `motm`)
  over the team's matches; `appearances` = matches with a `match_stats` row or a squad row. A player sees
  their own line; a manager the whole squad (the leaderboard sorts client-side).

Both RPCs: `revoke execute from public, anon; grant execute to authenticated`.
