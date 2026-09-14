-- S8.2 (V3): match opponent and home/away. Additive and backward compatible — both columns are
-- nullable, so existing rows (training, social, and any legacy match) stay null and every reader
-- of the row keeps working. The generated title lives in events.title as before; these columns
-- store the raw fields so the title can be regenerated and the share can render "Home"/"Away".
--
-- `home_away` is a brand-new enum type, so unlike `event_type` (S8.1) it may be created and used
-- in the same transaction — the add-value-then-use restriction applies only to ALTER TYPE ... ADD
-- VALUE on an existing enum.
create type public.home_away as enum ('home', 'away');

alter table public.events
  add column opponent  text,
  add column home_away public.home_away;

-- Belt and braces: both fields are meaningful only for a match. The form enforces per-type
-- requirements (opponent required for a match, absent otherwise); the DB refuses a stray value on
-- a training or social row.
alter table public.events
  add constraint events_opponent_match_only  check (opponent  is null or type = 'match'),
  add constraint events_home_away_match_only check (home_away is null or type = 'match');
