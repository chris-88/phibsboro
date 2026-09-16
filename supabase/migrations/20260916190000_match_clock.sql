-- S18.3 — a manual, saved match clock (Chris, 2026-09-16). Kick-off is manual because games get
-- delayed; the manager taps to start each half from the game-stats screen. The four period markers
-- live on the event so the clock survives closing the app and reads the same on any device — the
-- running minute is derived from them and the current time, never a ticking value stored anywhere.
-- Match-only, nullable; managers already update events (S4.2), so no new RLS — the columns ride the
-- existing events write path (the same as motm/score, X4).

alter table public.events add column first_half_kickoff_at  timestamptz;
alter table public.events add column half_time_at            timestamptz;
alter table public.events add column second_half_kickoff_at  timestamptz;
alter table public.events add column full_time_at            timestamptz;

alter table public.events add constraint events_match_clock_match_only check (
  (
    first_half_kickoff_at is null
    and half_time_at is null
    and second_half_kickoff_at is null
    and full_time_at is null
  )
  or type = 'match'
);
