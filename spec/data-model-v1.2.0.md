# v1.2.0 — Data-model changes

Additive to `spec/data-model.md` and `spec/data-model-v1.1.0.md`. One new table (`feedback`); "who's in"
adds no table and no column — it is a read-only RPC over existing rows.

## `feedback` — new table (Epic 12)

Tester and user feedback, triaged by admins in-app (W1).

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | PK |
| `user_id` | uuid | no | — | FK → `auth.users(id)` on delete cascade. The reporter; always `auth.uid()` on insert (W2). |
| `category` | `feedback_category` enum (`'bug'`\|`'idea'`\|`'other'`) | no | `'other'` | A one-tap triage bucket. |
| `message` | text | no | — | The report. Check `char_length(btrim(message)) between 1 and 2000`. |
| `context` | jsonb | yes | — | Auto-captured at submit: `route`, `release`, `user_agent`, `standalone`, `viewport` (W2). No PII beyond what the user types. |
| `status` | `feedback_status` enum (`'open'`\|`'resolved'`) | no | `'open'` | Admin triage state. |
| `created_at` | timestamptz | no | `now()` | |
| `resolved_at` | timestamptz | yes | — | Stamped when an admin resolves. |
| `resolved_by` | uuid | yes | — | FK → `auth.users(id)`; the admin who resolved. |

- New enums: `create type public.feedback_category as enum ('bug','idea','other');` and
  `create type public.feedback_status as enum ('open','resolved');`
- Index: `feedback(status, created_at desc)` — the admin inbox lists open first, newest first.
- `updated_at` is not needed; `resolved_at`/`created_at` carry the timeline.

### RLS (W2)

- **Enable RLS.** No policy is permissive by default.
- **Insert** — `authenticated`, `with check (user_id = auth.uid())`. A user can only file as themselves; a
  forged `user_id` is refused, not rewritten.
- **Select (own)** — a user may read rows where `user_id = auth.uid()` (so a "your feedback" list / receipt
  is possible), and nothing else.
- **Select (admin)** — `is_admin()` reads every row.
- **Update** — `is_admin()` only, and only `status`/`resolved_at`/`resolved_by` (enforced by the update
  policy + a trigger or a narrow RPC; a user never updates). No `delete` policy — feedback is not deletable
  from the client.
- Regenerate `src/lib/database.types.ts` after the migration; add a Zod schema `feedbackRowSchema` (S1.5
  parity test).

## "Who's in" — no schema change (Epic 13)

`event_responses`, `team_members` and `events` are unchanged, and the `event_responses` SELECT policy is
**not** relaxed (W4). Instead a read-only RPC computes the player-visible view:

```sql
create function public.event_availability(p_event_id uuid)
returns table (
  available_names   text[],  -- names of members who responded 'available', ordered
  available_count   int,
  unavailable_count int,
  awaiting_count    int,      -- squad_size - responded
  squad_size        int
)
language sql
security definer
set search_path = ''
```

- `SECURITY DEFINER`, so it reads all responses for the event's team regardless of the caller's own-row
  policy — but it returns only available **names** and the three **counts**, never a decliner's or
  non-responder's identity (W3).
- Guards inside the function: the event exists, its team is active, and `is_team_member(event.team_id)` —
  otherwise it returns no rows (a non-member or anon sees nothing, mirroring S1.3's "no rows, not an error").
- `revoke execute ... from public, anon;` then `grant execute ... to authenticated;` (the S1.3 RPC pattern).
- Counts derive from `team_members` (the squad, the denominator) and `event_responses` (S4.3's derivation,
  reused): `awaiting = squad_size - (available + unavailable)`.
