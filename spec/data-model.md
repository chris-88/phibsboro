# Data model

The settled schema. S1.1 and S1.3 are written from this file; where it disagrees with section 5 of
`CLAUDE.md`, this file wins, and every difference is recorded as a decision in
[00-decisions.md](00-decisions.md). Eight tables, four enums, no `clubs` table (D3).

Rules that apply everywhere:

- Every timestamp is `timestamptz` in UTC. Display formatting only ever goes through
  `formatEventTime()` (D35).
- Every user-referencing column targets `profiles(id)`, never `auth.users` (D4).
- Closed value sets are Postgres enums, so the generated types are unions rather than `string` (D24).
- Absence of a row is the third state. `event_responses` absent means "awaiting"; `attendance` absent
  means "not recorded". Neither is ever stored as a value (D25).
- RLS is on for all eight tables. Two of them carry no policy at all and are reachable only through
  security-definer RPCs.

## Enums

```sql
create type public.event_type            as enum ('training', 'match');
create type public.event_status          as enum ('scheduled', 'cancelled');
create type public.availability_response as enum ('available', 'unavailable');
create type public.member_role           as enum ('player', 'manager');
```

`member_role` has no `admin` member. Admin is a club-wide flag on `profiles` (D2).

---

## profiles

One row per account. Created by the S1.2 trigger on `auth.users` insert, never by a client.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | — | PK. `references auth.users(id) on delete cascade`. Same uuid as the auth user (D4). |
| `name` | `text` | no | — | `check (char_length(btrim(name)) between 1 and 80)` |
| `phone` | `text` | no | — | E.164 with leading `+`. `unique`. `check (phone ~ '^\+[1-9][0-9]{7,14}$')` |
| `is_admin` | `boolean` | no | `false` | Club-wide admin (D2). No client path writes it. |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key** `(id)`
- **Unique** `(phone)`
- **Indexes** the PK and the phone unique index; nothing else.

`auth.users.phone` is stored by Supabase without the leading `+`; the trigger prepends it so
`profiles.phone` is always full E.164 (D35).

## teams

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `name` | `text` | no | — | `check (char_length(btrim(name)) between 1 and 60)` |
| `active` | `boolean` | no | `true` | False blocks joins and event creation, hides the team from non-admins (D50) |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key** `(id)`
- **Unique** `create unique index teams_name_key on public.teams (lower(btrim(name)))`
- Teams are never hard deleted. Every FK to `teams` is `on delete restrict`.

## team_members

One row per user per team. One role per user per team.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `team_id` | `uuid` | no | — | `references teams(id) on delete restrict` |
| `user_id` | `uuid` | no | — | `references profiles(id) on delete cascade` |
| `role` | `member_role` | no | `'player'` | Never `admin` (D2) |
| `joined_at` | `timestamptz` | no | `now()` | Set once by the join RPC; an idempotent re-join does not reset it (D26) |

- **Primary key** `(team_id, user_id)` (D5)
- **Indexes** `create index team_members_user_id_idx on public.team_members (user_id)`
- No client INSERT, UPDATE or DELETE. All three go through RPCs (D9).

## team_invites

Join links. Not selectable by any client.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `team_id` | `uuid` | no | — | `references teams(id) on delete restrict` |
| `token` | `text` | no | — | `unique`. 32 bytes from `gen_random_bytes(32)`, base64url, generated in the RPC (D5) |
| `role` | `member_role` | no | — | The role granted on join. Taken from this row, never from a client argument |
| `active` | `boolean` | no | `true` | Revoke sets it false |
| `expires_at` | `timestamptz` | yes | — | Player link: `now() + 90 days`. Manager link: `now() + 24 hours` (D28) |
| `created_by` | `uuid` | yes | — | `references profiles(id) on delete set null` |
| `created_at` | `timestamptz` | no | `now()` | |

- **Primary key** `(id)`
- **Unique** `(token)`; and `create unique index team_invites_one_live_idx on public.team_invites
  (team_id, role) where active` — at most one live link per team per role (D28)
- A manager link is single-use: the join RPC sets `active = false` on first successful join.
- RLS enabled, **zero policies**. Reachable only through the RPCs below.

## reset_tokens

One-time password reset links issued by a manager or admin.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | `references profiles(id) on delete cascade`. The account being reset |
| `team_id` | `uuid` | no | — | `references teams(id) on delete restrict`. The team the issuer acted under, for audit (D27) |
| `token` | `text` | no | — | `unique`. Same generation as `team_invites.token` |
| `issued_at` | `timestamptz` | no | `now()` | |
| `expires_at` | `timestamptz` | no | `now() + interval '24 hours'` | |
| `used_at` | `timestamptz` | yes | — | Set on redemption. Single use |
| `revoked_at` | `timestamptz` | yes | — | Set when a newer token is issued for the same user (D27) |
| `created_by` | `uuid` | yes | — | `references profiles(id) on delete set null` |

- **Primary key** `(id)`
- **Unique** `(token)`
- **Indexes** `create index reset_tokens_live_idx on public.reset_tokens (user_id)
  where used_at is null and revoked_at is null`
- Redeemable only when `used_at is null and revoked_at is null and expires_at > now()`.
- RLS enabled, **zero policies**. Reachable only through the RPCs below.

## events

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK. Never sequential, never short: it is a bearer join credential (D6) |
| `team_id` | `uuid` | no | — | `references teams(id) on delete restrict` |
| `type` | `event_type` | no | — | |
| `title` | `text` | no | — | `check (char_length(btrim(title)) between 1 and 80)`. Defaults by type in the S4.1 form, not in SQL |
| `location` | `text` | no | — | `check (char_length(btrim(location)) between 1 and 120)` |
| `notes` | `text` | yes | — | `check (notes is null or char_length(notes) <= 500)`. Never returned by `get_event_preview` |
| `starts_at` | `timestamptz` | no | — | |
| `status` | `event_status` | no | `'scheduled'` | Cancel sets `'cancelled'`; nothing is deleted (D31) |
| `series_id` | `uuid` | yes | — | Set only on rows generated by S4.6. No read query filters on it (D30) |
| `created_by` | `uuid` | yes | — | `references profiles(id) on delete set null` |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | Maintained by a `before update` trigger |

- **Primary key** `(id)`
- **Indexes** `create index events_team_starts_idx on public.events (team_id, starts_at)`;
  `create unique index events_series_slot_idx on public.events (team_id, starts_at)
  where series_id is not null` — makes the S4.6 generator idempotent (D30)
- DELETE requires `is_admin()`. A manager cancels; only an admin destroys (D31).

## event_responses

Availability. Absence of a row means awaiting.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `event_id` | `uuid` | no | — | `references events(id) on delete cascade` (D31) |
| `user_id` | `uuid` | no | — | `references profiles(id) on delete cascade` |
| `response` | `availability_response` | no | — | |
| `updated_at` | `timestamptz` | no | `now()` | Maintained by a `before update` trigger |

- **Primary key** `(event_id, user_id)` (D5)
- **Indexes** `create index event_responses_user_idx on public.event_responses (user_id)` (D39)
- No client DELETE. A player switches between the two values; they cannot return to awaiting (D61).
- Player writes carry the cut-off check: the event must be `scheduled` and `starts_at > now()` (D12).

## attendance

Who actually turned up. Absence of a row means not recorded.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `event_id` | `uuid` | no | — | `references events(id) on delete cascade` |
| `user_id` | `uuid` | no | — | `references profiles(id) on delete cascade` |
| `attended` | `boolean` | no | — | Never null. Clearing the toggle deletes the row (D25) |
| `recorded_by` | `uuid` | yes | — | `references profiles(id) on delete set null` |
| `updated_at` | `timestamptz` | no | `now()` | Maintained by a `before update` trigger |

- **Primary key** `(event_id, user_id)` (D5)
- **Indexes** `create index attendance_user_idx on public.attendance (user_id)` (D39)
- Players have no write of any kind. Managers and admins insert, update and delete.

---

## Entity relationships

```
                         auth.users
                             │ 1:1, same uuid, on delete cascade
                             ▼
                         profiles ──────────────┐
                    (id, name, phone,           │ created_by / recorded_by
                     is_admin)                  │ (nullable, on delete set null)
                             │                  │
             user_id         │                  │
   ┌─────────────────────────┼──────────────────┼──────────────────┐
   │ on delete cascade       │                  │                  │
   ▼                         ▼                  │                  ▼
team_members            event_responses         │             attendance
(team_id, user_id)      (event_id, user_id)     │        (event_id, user_id)
 PK, role, joined_at     PK, response            │         PK, attended
   │                         │                  │                  │
   │ team_id                 │ event_id         │                  │ event_id
   │ on delete restrict      │ on delete cascade│                  │ on delete cascade
   │                         └────────┬─────────┴──────────────────┘
   │                                  ▼
   │                              events
   │                   (id, team_id, type, title, location,
   │                    notes, starts_at, status, series_id)
   │                                  │ team_id, on delete restrict
   ▼                                  ▼
                    teams (id, name, active)
                        ▲                ▲
            team_id     │                │ team_id
                        │                │
                 team_invites      reset_tokens
             (token, role, active,  (user_id, token, issued_at,
              expires_at)            expires_at, used_at, revoked_at)
                                           │ user_id → profiles, on delete cascade
```

Cardinalities: a profile has many memberships; a team has many members and many events; an event has at
most one response and at most one attendance row per user. A user holds one role per team and may hold
different roles on different teams.

---

## Access matrix

What the anon key can do, by role, through PostgREST. `S` select, `I` insert, `U` update, `D` delete,
`—` nothing, `RPC` reachable only through a security-definer function. Admin means
`profiles.is_admin = true`; manager and player mean the `team_members.role` for the team in question.
This matrix is what S1.4 asserts, positively and negatively, for every cell.

| Table | Anonymous | Player | Manager (teams they manage) | Admin |
|---|---|---|---|---|
| `profiles` | — | `S` own row only | `S` own row only | `S` own row only |
| `teams` | — | `S` teams they belong to | `S` teams they belong to | `S I U` all |
| `team_members` | — | `S` rows of teams they belong to | `S` rows of teams they belong to | `S` all |
| `team_invites` | — | — | — | — |
| `reset_tokens` | — | — | — | — |
| `events` | — | `S` own teams, plus any event they hold a response or attendance row for | `S I U` | `S I U D` all |
| `event_responses` | — | `S` own rows; `I U` own row while the event is scheduled and unstarted | `S` all rows for events on their teams | `S I U D` all |
| `attendance` | — | `S` own rows | `S I U D` for events on their teams | `S I U D` all |

Notes that the matrix cannot carry:

- Other people's **names** never come from `profiles`. They come from `team_member_directory` (D8).
  **Phone numbers** are returned by that RPC only to a manager of that team or an admin, and are null for
  everyone else.
- Manager and admin reads of `event_responses` and `attendance` are scoped by the **owning event's team**,
  never by the responder's current membership, so a leaver's historic rows stay readable (D33).
- `events` INSERT additionally requires `teams.active = true` (D50).
- `event_responses` player INSERT and UPDATE carry:
  `WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND
  e.status = 'scheduled' AND e.starts_at > now() AND public.is_team_member(e.team_id)))` (D12).
- `events` DELETE is `is_admin()` only. A manager cancels (D31).
- DELETE on `event_responses` is admin only. No player and no manager may delete a response, which is what
  D12 and D61 mean by "no client DELETE"; the grant exists so the admin policy can use it.
- A signed-in user who belongs to no team is the fourth test role in S1.4 and is denied on every row of
  this matrix (D37).
- The anonymous column is empty on purpose. Anonymous reach is exactly `get_event_preview`,
  `lookup_team_invite` and `redeem_reset_token`, listed below. `redeem_reset_token` is granted to
  `authenticated` as well, because a player who is still signed in on an old session may open a reset
  link; the token, not the session, is what authorises it.

### Helper functions

All three are `security definer`, `stable`, `set search_path = ''`, and fully qualify every object.

```sql
public.is_admin() returns boolean
  -- coalesce((select is_admin from public.profiles where id = auth.uid()), false)

public.is_team_member(p_team_id uuid) returns boolean
  -- exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid())

public.is_team_manager(p_team_id uuid) returns boolean
  -- is_admin() or exists (... and role = 'manager')
```

---

## Security-definer RPCs

Every function below is `security definer`, declares `set search_path = ''`, fully qualifies every
object, and is granted with:

```sql
revoke execute on function public.<fn>(...) from public;
grant  execute on function public.<fn>(...) to <anon | authenticated>;
```

Failure convention: a **lookup** returns zero rows; an **action** raises a single opaque error the UI maps
to plain copy. Errors never distinguish "unknown" from "expired" from "revoked", so nothing can be probed.
Every validation rule below is a positive and a negative test in S1.4.

### Reads

**`get_event_preview(p_event_id uuid)`** → `anon`, `authenticated`
Returns `team_id, team_name, type, title, location, starts_at, status`. Never `notes`, `created_by`,
responses, counts or member lists. Zero rows for an unknown id. This is the cold-arrival screen (D7).

**`lookup_team_invite(p_token text)`** → `anon`, `authenticated`
Returns `team_id, team_name, role`. Validates `active`, `expires_at is null or expires_at > now()`, and
`teams.active`. Zero rows on any failure, so tokens cannot be enumerated or distinguished (D28).

**`team_member_directory(p_team_id uuid)`** → `authenticated`
Returns `user_id, name, role, joined_at, phone`. `phone` is null unless the caller is a manager of that
team or an admin. Zero rows if the caller is not a member of that team and not an admin. This is the only
route to another user's name (D8).

### Joining

**`join_team_by_token(p_token text)`** → `authenticated`
Validates the token as `lookup_team_invite` does, plus `teams.active`. Takes the granted role from the
invite row, never from a client argument, and refuses any role other than `player` or `manager`. Inserts
`on conflict (team_id, user_id) do nothing`, so it is idempotent and does not reset `joined_at` (D26).
Sets `active = false` on a manager invite after a successful join (D28). Returns `team_id, team_name`.
Raises `invalid_invite` otherwise.

**`join_team_by_event(p_event_id uuid)`** → `authenticated`
Joins the caller as `player` to the event's team. Validates that the event exists, that `teams.active` is
true, and that `starts_at > now() - interval '7 days'`. Idempotent in the same way. Returns
`team_id, team_name`. Raises `invalid_invite` otherwise. The event link is a deliberate standing join
credential with the same trust basis as the squad WhatsApp group (D6).

### Invites

**`create_team_invite(p_team_id uuid, p_role member_role)`** → `authenticated`, returns `text`
Permitted when `is_team_manager(p_team_id)` and `p_role = 'player'`, or when `is_admin()` for either role.
A manager attempting to mint a manager invite raises `not_authorised`. Deactivates the existing live
invite for `(team_id, role)` and inserts the replacement in the same transaction, so the partial unique
index always holds. Expiry: 90 days for `player`, 24 hours for `manager`. Returns the new token (D28, D29).

**`get_team_invite(p_team_id uuid, p_role member_role)`** → `authenticated`
Returns `token, role, expires_at, created_at` for the one live invite on `(team_id, role)`. Permitted for
`p_role = 'player'` when `is_team_manager(p_team_id)`, and for `p_role = 'manager'` when `is_admin()`.
Zero rows on every other path, including an unauthorised caller, so nothing can be probed. This is the
read path D62 assumes: a manager must be able to re-copy a live join link at any time, which is why the
token is stored in plaintext rather than hashed.

**`revoke_team_invite(p_team_id uuid, p_role member_role)`** → `authenticated`, returns `void`
Same authorisation. Sets `active = false` on the live row. Revoking invalidates the old token immediately
and does not touch memberships already created.

### Reset

**`issue_reset_token(p_user_id uuid, p_team_id uuid)`** → `authenticated`, returns `text`
Permitted when `is_admin()`, or when `is_team_manager(p_team_id)` **and** the target holds a
`team_members` row on that team with `role = 'player'` **and** the target holds no `manager` role on any
team **and** the target is not an admin. Revokes every live token for that user, then inserts the new one.
Returns the token, which the manager copies into WhatsApp. Raises `not_authorised` otherwise (D10).

**`redeem_reset_token(p_token text, p_new_password text)`** → `anon`, `authenticated`, returns `text`
Validates `used_at is null and revoked_at is null and expires_at > now()`, and
`char_length(p_new_password) >= 8`. Writes `crypt(p_new_password, gen_salt('bf'))` to
`auth.users.encrypted_password`; sets `used_at`; revokes the user's other live tokens; deletes the user's
refresh tokens so no stale session survives. Returns the user's phone, which the client passes straight to
`signInWithPassword`. Raises `invalid_token` on every failure path (D10, D11).

### Membership administration

**`set_member_role(p_team_id uuid, p_user_id uuid, p_role member_role)`** → `authenticated`, returns `void`
`is_admin()` only. Grants or revokes `manager`. Admin is not grantable through the app at all (D2, D9).

**`remove_member(p_team_id uuid, p_user_id uuid)`** → `authenticated`, returns `void`
A manager may remove only members whose role is `player` on a team they manage. An admin may remove
anyone. Deletes the `team_members` row and nothing else (D9, D33).

**`set_member_phone(p_user_id uuid, p_phone text)`** → `authenticated`, returns `void`
`is_admin()` only. Validates E.164, then updates `auth.users.phone` and `profiles.phone` in one
transaction. Raises `phone_taken` on a duplicate rather than surfacing a Postgres unique violation. The
only remedy for a typo or a squatted number (D51).

### Events

**`generate_training_series(p_team_id uuid, p_first_starts_at timestamptz, p_weeks int, p_title text, p_location text)`** → `authenticated`, returns `setof uuid`
`is_team_manager(p_team_id)` and `teams.active`. Raises when `p_weeks > 16` or the run would insert more
than 20 rows. Inserts weekly `training` rows with a shared `series_id`, `on conflict do nothing` against
the partial unique index, so re-running an overlapping window creates no duplicates. Returns the ids
created, so the UI can state the count (D30).

---

## Retention

Nothing in this app deletes history. The rules, in full:

**Removing a membership** (`remove_member`) deletes the `team_members` row and nothing else. The person's
`event_responses` and `attendance` rows stay. They vanish from the manager's squad counts and response
list immediately (D22), and they remain visible to the person themselves under `/history`, because the
player read policies key on `user_id = auth.uid()` with no membership test and a player may read any event
they hold a row for (D33). Rejoining later creates a fresh `team_members` row with a new `joined_at`; the
old rows reattach on their own, since they were never detached.

**Cancelling an event** sets `status = 'cancelled'`. No row is deleted. Existing responses and attendance
stay readable. No new or changed responses are accepted, enforced by the RLS check, not the UI (D12). The
event stays in the S3.2 list marked cancelled, and never occupies the next-event card (D60).

**Deactivating a team** sets `teams.active = false`. No row is deleted. Joins by token and by event link
are both refused, event creation is refused, and the team disappears from non-admin lists. Admins keep
full read and write access to everything it holds (D50).

**Hard-deleting an event** is admin-only, exposed nowhere in the manager UI, and cascades to that event's
`event_responses` and `attendance`. It sits behind a typed confirmation naming the event (D31).

**Teams are never hard-deleted.** Every FK to `teams` is `on delete restrict`, so the attempt fails
loudly rather than taking a season's history with it.

**Deleting an account** is not an app function. Deleting the `auth.users` row cascades to `profiles`, then
to that person's memberships, responses and attendance. `created_by` and `recorded_by` references set null
rather than cascading, so the events they created and the attendance they recorded survive them.
