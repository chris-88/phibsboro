-- S4.6 — generate_training_series: add weeks in Dublin wall-clock time, not absolute time.
--
-- The body shipped by 20260913130450_rpcs.sql (and re-stated by 20260913133408_rpc_argument_guards.sql)
-- adds `p_first_starts_at + (n * interval '7 days')` to a timestamptz, which is 168 hours of
-- absolute time. A 7.30pm session generated in February becomes 8.30pm Dublin after the March
-- clock change, and players turn up an hour late. This `create or replace` moves the arithmetic to
-- Dublin wall-clock time so 7.30pm stays 7.30pm across a boundary; everything else — signature,
-- grants, owner, security-definer settings and the six-word error vocabulary — is unchanged. A
-- forward-only correction, per D18: no applied migration is edited.

create or replace function public.generate_training_series(
  p_team_id         uuid,
  p_first_starts_at timestamptz,
  p_weeks           int,
  p_title           text,
  p_location        text
)
returns setof uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_series   uuid := gen_random_uuid();
  v_title    text := left(btrim(coalesce(p_title, '')), 80);
  v_location text := left(btrim(coalesce(p_location, '')), 120);
  -- The first session as a Dublin wall clock (no zone). Adding whole weeks to this, then reading
  -- it back at Europe/Dublin, keeps the time of day fixed across a clock change (D35, D53).
  v_local    timestamp;
begin
  if not public.is_team_manager(p_team_id)
     or not exists (select 1 from public.teams t where t.id = p_team_id and t.active) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  if p_weeks is null or p_weeks < 1 or p_weeks > 16 then
    raise exception using errcode = 'P0001', message = 'series_too_long';
  end if;
  -- A past session can never take a response (D12).
  if p_first_starts_at is null or p_first_starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'starts_in_past';
  end if;
  if v_title = '' then
    v_title := 'Training';
  end if;
  -- A title defaults by type (S4.1); a location has no default, so a blank one is refused here
  -- rather than by events_location_check.
  if v_location = '' then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  v_local := p_first_starts_at at time zone 'Europe/Dublin';

  -- Idempotent against events_series_slot_idx: re-running an overlapping window adds nothing.
  -- Weeks are added to the wall clock and the slot is resolved back to an instant at Dublin, so
  -- a session after a clock change keeps its local time and shifts by an hour in UTC instead. A
  -- slot in the spring-forward gap is resolved by `at time zone`, not special-cased; nobody
  -- trains at 1.30am.
  return query
    insert into public.events (team_id, type, title, location, starts_at, series_id, created_by)
    select p_team_id, 'training', v_title, v_location,
           (v_local + (n * interval '7 days')) at time zone 'Europe/Dublin', v_series, auth.uid()
    from generate_series(0, p_weeks - 1) as n
    on conflict (team_id, starts_at) where series_id is not null do nothing
    returning id;
end;
$$;
