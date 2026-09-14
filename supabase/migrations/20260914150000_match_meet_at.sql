-- S8.3 (V4): match meet/arrival time. Additive and backward compatible — the column is nullable,
-- so existing rows (training, social, and matches created before this) stay null and every reader
-- of the row keeps working. `starts_at` stays kick-off and keeps driving the respond-until-start
-- rule (S3.4/D12); `meet_at` is the earlier arrival time, match-only, shown alongside kick-off.
alter table public.events
  add column meet_at timestamptz;

-- Meet must be strictly before kick-off when both are set; and, belt and braces like opponent and
-- home/away (S8.2), a meet time is meaningful only for a match. The form enforces both inline; the
-- DB refuses a stray or out-of-order value as the backstop.
alter table public.events
  add constraint events_meet_before_kickoff
    check (meet_at is null or starts_at is null or meet_at < starts_at),
  add constraint events_meet_at_match_only
    check (meet_at is null or type = 'match');
