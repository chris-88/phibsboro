-- Fix: joining by a manager invite must UPGRADE an existing membership's role, not silently no-op.
--
-- join_team_by_token inserted the membership `on conflict ... do nothing`. A player who had already
-- joined a team (via a player link, or an event link) and then redeemed that team's *manager*
-- invite hit the (team_id, user_id) conflict: the manager row was discarded and they stayed a
-- player — while the single-use manager invite was still consumed, so re-tapping could not fix it.
-- (Reported 2026-09-15: a user joined PCF II as a player, redeemed the PCF II manager link, signed
-- in when it recognised their number, and was left with only player access.)
--
-- The insert now upgrades on conflict, but only ever upwards: `where m.role < excluded.role`, so a
-- manager who taps a player/event link for a team they already manage is never downgraded, and a
-- same-role re-join is still a no-op (idempotent, D26). member_role is an ordered enum
-- (player < manager), so the comparison needs no rank table. join_team_by_event is left unchanged:
-- it always joins as the lowest role, 'player', so its `do nothing` can never wrongly keep a higher
-- role. CREATE OR REPLACE preserves the revoke/grant from 20260913130450_rpcs.sql.

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

  -- The role comes from the invite row, never from an argument. On a re-join we upgrade only when
  -- the invite outranks the current role (manager > player); an equal or lower invite is a no-op,
  -- so a manager is never downgraded and a repeat tap changes nothing.
  insert into public.team_members as m (team_id, user_id, role)
  values (v_team_id, v_uid, v_role)
  on conflict on constraint team_members_pkey do update
    set role = excluded.role
    where m.role < excluded.role;

  if v_role = 'manager' then
    update public.team_invites set active = false where id = v_invite_id;
  end if;

  return query select v_team_id, v_team_name;
end;
$$;
