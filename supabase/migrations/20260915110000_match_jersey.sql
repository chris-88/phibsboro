-- S15.1 — the match jersey (v1.2.0, W7). Which kit the team wears for a match: Black, Light Blue
-- ('sky') or White. Match-only and nullable, alongside opponent/home_away/meet_at (V2). Shown on
-- the event and in the WhatsApp teamsheet.

create type public.jersey as enum ('black', 'sky', 'white');

alter table public.events add column jersey public.jersey;

-- Belt and braces, mirroring events_home_away_match_only / events_opponent_match_only.
alter table public.events
  add constraint events_jersey_match_only check (jersey is null or type = 'match');
