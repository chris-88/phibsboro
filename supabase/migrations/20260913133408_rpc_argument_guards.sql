-- S1.3 amendment two — argument guards (AC23).
--
-- Adversarial verification called five RPCs with a null or blank argument that the S4.6 and S6.x
-- forms never send, and four of them let a Postgres 23502 / 23514 through, naming a column and a
-- relation: generate_training_series (location), set_member_phone (phone), set_member_role (role)
-- and create_team_invite (role, admin path only — `p_role = 'player'` is null, so the manager
-- branch drops out and is_admin() carries the guard). PostgREST passes JSON null as SQL null, so
-- every one of them was reachable from the anon key plus a session.
--
-- Each now raises `not_authorised`, the word the story already uses for a malformed `p_phone` in
-- set_member_phone. The vocabulary stays at six (A12). Bodies are otherwise byte-identical to
-- 20260913130450_rpcs.sql; `create or replace` keeps owner and grants.

create or replace function public.create_team_invite(p_team_id uuid, p_role public.member_role)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  if p_role is null
     or not ((p_role = 'player' and public.is_team_manager(p_team_id)) or public.is_admin()) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  if not exists (select 1 from public.teams t where t.id = p_team_id and t.active) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  -- Retire then replace, in one transaction, so team_invites_one_live_idx never trips.
  update public.team_invites
     set active = false
   where team_id = p_team_id and role = p_role and active;

  insert into public.team_invites (team_id, token, role, expires_at, created_by)
  values (
    p_team_id,
    public.new_token(),
    p_role,
    now() + case p_role when 'player' then interval '90 days' else interval '24 hours' end,
    auth.uid()
  )
  returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.revoke_team_invite(p_team_id uuid, p_role public.member_role)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_role is null
     or not ((p_role = 'player' and public.is_team_manager(p_team_id)) or public.is_admin()) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  if not exists (select 1 from public.teams t where t.id = p_team_id and t.active) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  -- Memberships already created are untouched.
  update public.team_invites
     set active = false
   where team_id = p_team_id and role = p_role and active;
end;
$$;

create or replace function public.set_member_role(
  p_team_id uuid,
  p_user_id uuid,
  p_role    public.member_role
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_role is null or not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  update public.team_members
     set role = p_role
   where team_id = p_team_id and user_id = p_user_id;
end;
$$;

create or replace function public.set_member_phone(p_user_id uuid, p_phone text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  -- `null !~ pattern` is null, which `if` reads as false: test the null explicitly.
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  -- auth.users stores the number without the '+'; profiles keeps full E.164 (D35).
  update auth.users
     set phone              = ltrim(p_phone, '+'),
         phone_confirmed_at = now(),
         updated_at         = now()
   where id = p_user_id;

  update public.profiles set phone = p_phone where id = p_user_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'phone_taken';
end;
$$;

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

  -- Idempotent against events_series_slot_idx: re-running an overlapping window adds nothing.
  return query
    insert into public.events (team_id, type, title, location, starts_at, series_id, created_by)
    select p_team_id, 'training', v_title, v_location,
           p_first_starts_at + (n * interval '7 days'), v_series, auth.uid()
    from generate_series(0, p_weeks - 1) as n
    on conflict (team_id, starts_at) where series_id is not null do nothing
    returning id;
end;
$$;
