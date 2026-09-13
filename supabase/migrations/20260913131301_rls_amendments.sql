-- S1.3 — three corrections found by running the policy set against the hosted project with real
-- JWTs, after the first three files had already been applied there. An applied migration is never
-- edited (supabase/migrations/README.md), so they land as a fourth file. Every statement here is
-- idempotent.

-- 1. The story's grant block gave authenticated only select on teams, but the access matrix and
--    the teams_insert_admin / teams_update_admin policies need insert and update. Without the
--    grant an admin creating a team got 42501 before the policy was consulted. Non-admins still
--    get zero rows from an update and a policy refusal from an insert.
grant insert, update on public.teams to authenticated;

-- 2. In a plpgsql function that `returns table (team_id ...)`, the output column is a variable,
--    and `on conflict (team_id, user_id)` is then "column reference team_id is ambiguous"
--    (42702) at run time. Name the constraint instead.
create or replace function public.join_team_by_token(p_token text)
returns table (team_id uuid, team_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_invite_id uuid;
  v_team_id   uuid;
  v_team_name text;
  v_role      public.member_role;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'invalid_invite';
  end if;

  -- Lock the invite row so two taps on a single-use manager link cannot both succeed.
  select i.id, i.team_id, t.name, i.role
    into v_invite_id, v_team_id, v_team_name, v_role
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  where i.token = p_token
    and i.active
    and (i.expires_at is null or i.expires_at > now())
    and t.active
  for update of i;

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_invite';
  end if;

  -- The role comes from the row, never from an argument. Idempotent: a re-join changes nothing.
  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_uid, v_role)
  on conflict on constraint team_members_pkey do nothing;

  if v_role = 'manager' then
    update public.team_invites set active = false where id = v_invite_id;
  end if;

  return query select v_team_id, v_team_name;
end;
$$;

create or replace function public.join_team_by_event(p_event_id uuid)
returns table (team_id uuid, team_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_team_id   uuid;
  v_team_name text;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'invalid_invite';
  end if;

  select e.team_id, t.name
    into v_team_id, v_team_name
  from public.events e
  join public.teams t on t.id = e.team_id
  where e.id = p_event_id
    and t.active
    and e.starts_at > now() - interval '7 days';

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_invite';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_uid, 'player')
  on conflict on constraint team_members_pkey do nothing;

  return query select v_team_id, v_team_name;
end;
$$;

-- 3. S1.1's updated_at trigger function still carried the platform's default execute grant to
--    anon and authenticated. A trigger fires without the invoking role holding execute on its
--    function (checked on the hosted project), so nothing needs it, and AC3's "anon executes
--    exactly three functions" is now literally true.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
