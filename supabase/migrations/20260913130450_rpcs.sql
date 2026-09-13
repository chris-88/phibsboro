-- S1.3 — the fourteen security-definer RPCs from spec/data-model.md. Every privileged action a
-- screen will need — preview, join, invite, reset, role change, directory — is a named function
-- with its authorisation written into it.
--
-- A security-definer body runs as postgres and bypasses RLS. There is no policy backstop inside
-- these functions; every authorisation check is the explicit `if not ... then raise` at the top.
--
-- Failure convention: a lookup returns zero rows and never raises, so tokens cannot be probed;
-- an action raises one of exactly six messages — invalid_invite, invalid_token, not_authorised,
-- phone_taken, series_too_long, starts_in_past — and never a token, an id or a reason (AC23).
-- src/lib/errors.ts (S1.5) maps them to copy.

-- ---------------------------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------------------------

-- The cold-arrival screen (D7). No notes, no created_by, no counts, no members.
create or replace function public.get_event_preview(p_event_id uuid)
returns table (
  team_id   uuid,
  team_name text,
  type      public.event_type,
  title     text,
  location  text,
  starts_at timestamptz,
  status    public.event_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.team_id, t.name, e.type, e.title, e.location, e.starts_at, e.status
  from public.events e
  join public.teams t on t.id = e.team_id
  where e.id = p_event_id;
$$;

create or replace function public.lookup_team_invite(p_token text)
returns table (team_id uuid, team_name text, role public.member_role)
language sql
stable
security definer
set search_path = ''
as $$
  select i.team_id, t.name, i.role
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  where i.token = p_token
    and i.active
    and (i.expires_at is null or i.expires_at > now())
    and t.active;
$$;

-- The only route to another user's name (D8). Phone only to a manager of the team or an admin.
create or replace function public.team_member_directory(p_team_id uuid)
returns table (
  user_id   uuid,
  name      text,
  role      public.member_role,
  joined_at timestamptz,
  phone     text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_team_member(p_team_id) or public.is_admin()) then
    return;
  end if;

  return query
    select m.user_id, p.name, m.role, m.joined_at,
           case when public.is_team_manager(p_team_id) then p.phone else null end
    from public.team_members m
    join public.profiles p on p.id = m.user_id
    where m.team_id = p_team_id
    order by p.name;
end;
$$;

-- The read path D62 assumes: a manager re-copies a live join link. Zero rows on every other path.
create or replace function public.get_team_invite(p_team_id uuid, p_role public.member_role)
returns table (token text, role public.member_role, expires_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.token, i.role, i.expires_at, i.created_at
  from public.team_invites i
  where i.team_id = p_team_id
    and i.role    = p_role
    and i.active
    and (i.expires_at is null or i.expires_at > now())
    and (
         (p_role = 'player'  and public.is_team_manager(p_team_id))
      or (p_role = 'manager' and public.is_admin())
    );
$$;

-- ---------------------------------------------------------------------------------------------
-- Joining (D6, D26, D28, D50)
-- ---------------------------------------------------------------------------------------------

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
  on conflict (team_id, user_id) do nothing;

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
  on conflict (team_id, user_id) do nothing;

  return query select v_team_id, v_team_name;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Invites (D28, D29)
-- ---------------------------------------------------------------------------------------------

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
  if not ((p_role = 'player' and public.is_team_manager(p_team_id)) or public.is_admin()) then
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
  if not ((p_role = 'player' and public.is_team_manager(p_team_id)) or public.is_admin()) then
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

-- ---------------------------------------------------------------------------------------------
-- Password reset (D10, D11, D27)
-- ---------------------------------------------------------------------------------------------

create or replace function public.issue_reset_token(p_user_id uuid, p_team_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  -- A manager may reset a player on a team they manage who holds manager nowhere and is not
  -- an admin. An admin may reset anyone. Nobody resets an admin through the app: that is SQL.
  if public.is_admin() then
    if not exists (select 1 from public.profiles p where p.id = p_user_id)
       or not exists (select 1 from public.teams t where t.id = p_team_id) then
      raise exception using errcode = 'P0001', message = 'not_authorised';
    end if;
  elsif not (
    public.is_team_manager(p_team_id)
    and exists (
      select 1 from public.team_members m
      where m.team_id = p_team_id and m.user_id = p_user_id and m.role = 'player'
    )
    and not exists (
      select 1 from public.team_members m
      where m.user_id = p_user_id and m.role = 'manager'
    )
    and not coalesce((select p.is_admin from public.profiles p where p.id = p_user_id), true)
  ) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  -- Issuing a new link invalidates every previous one for that user.
  update public.reset_tokens
     set revoked_at = now()
   where user_id = p_user_id and used_at is null and revoked_at is null;

  insert into public.reset_tokens (user_id, team_id, token, created_by)
  values (p_user_id, p_team_id, public.new_token(), auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

-- The only function that writes outside public. Owned by postgres, which holds rights on auth.
-- Returns the full E.164 phone from profiles: auth.users.phone has no leading '+' (D35).
create or replace function public.redeem_reset_token(p_token text, p_new_password text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_user_id uuid;
  v_phone   text;
begin
  if p_token is null or char_length(coalesce(p_new_password, '')) < 8 then
    raise exception using errcode = 'P0001', message = 'invalid_token';
  end if;

  select r.id, r.user_id
    into v_id, v_user_id
  from public.reset_tokens r
  where r.token = p_token
    and r.used_at is null
    and r.revoked_at is null
    and r.expires_at > now()
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_token';
  end if;

  -- bcrypt at cost 10, what GoTrue itself writes.
  update auth.users
     set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
         updated_at         = now()
   where id = v_user_id;

  update public.reset_tokens set used_at = now() where id = v_id;

  update public.reset_tokens
     set revoked_at = now()
   where user_id = v_user_id and used_at is null and revoked_at is null;

  -- No stale session survives a reset. refresh_tokens.user_id is varchar, so cast, or the
  -- delete silently matches nothing. Sessions go too: refresh tokens hang off them.
  delete from auth.refresh_tokens where user_id = v_user_id::text;
  delete from auth.sessions       where user_id = v_user_id;

  select p.phone into v_phone from public.profiles p where p.id = v_user_id;
  return v_phone;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Membership administration (D9, D51)
-- ---------------------------------------------------------------------------------------------

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
  if not public.is_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  update public.team_members
     set role = p_role
   where team_id = p_team_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_member(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or (
      public.is_team_manager(p_team_id)
      and exists (
        select 1 from public.team_members m
        where m.team_id = p_team_id and m.user_id = p_user_id and m.role = 'player'
      )
    )
  ) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  -- The membership row and nothing else. Responses and attendance stay (D33).
  delete from public.team_members
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
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' then
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

-- ---------------------------------------------------------------------------------------------
-- Events (D30). Shipped here so S1.4 covers it once; the form is S4.6.
-- ---------------------------------------------------------------------------------------------

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
  v_series uuid := gen_random_uuid();
  v_title  text := left(btrim(coalesce(p_title, '')), 80);
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

  -- Idempotent against events_series_slot_idx: re-running an overlapping window adds nothing.
  return query
    insert into public.events (team_id, type, title, location, starts_at, series_id, created_by)
    select p_team_id, 'training', v_title, left(btrim(p_location), 120),
           p_first_starts_at + (n * interval '7 days'), v_series, auth.uid()
    from generate_series(0, p_weeks - 1) as n
    on conflict (team_id, starts_at) where series_id is not null do nothing
    returning id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Ownership and grants. The default ACL hands execute to anon, authenticated and service_role;
-- start every function from nothing and grant per the table in the story.
-- ---------------------------------------------------------------------------------------------

alter function public.get_event_preview(uuid)                                    owner to postgres;
alter function public.lookup_team_invite(text)                                   owner to postgres;
alter function public.team_member_directory(uuid)                                owner to postgres;
alter function public.get_team_invite(uuid, public.member_role)                  owner to postgres;
alter function public.join_team_by_token(text)                                   owner to postgres;
alter function public.join_team_by_event(uuid)                                   owner to postgres;
alter function public.create_team_invite(uuid, public.member_role)               owner to postgres;
alter function public.revoke_team_invite(uuid, public.member_role)               owner to postgres;
alter function public.issue_reset_token(uuid, uuid)                              owner to postgres;
alter function public.redeem_reset_token(text, text)                             owner to postgres;
alter function public.set_member_role(uuid, uuid, public.member_role)            owner to postgres;
alter function public.remove_member(uuid, uuid)                                  owner to postgres;
alter function public.set_member_phone(uuid, text)                               owner to postgres;
alter function public.generate_training_series(uuid, timestamptz, int, text, text) owner to postgres;

revoke execute on function public.get_event_preview(uuid)                                    from public, anon, authenticated;
revoke execute on function public.lookup_team_invite(text)                                   from public, anon, authenticated;
revoke execute on function public.team_member_directory(uuid)                                from public, anon, authenticated;
revoke execute on function public.get_team_invite(uuid, public.member_role)                  from public, anon, authenticated;
revoke execute on function public.join_team_by_token(text)                                   from public, anon, authenticated;
revoke execute on function public.join_team_by_event(uuid)                                   from public, anon, authenticated;
revoke execute on function public.create_team_invite(uuid, public.member_role)               from public, anon, authenticated;
revoke execute on function public.revoke_team_invite(uuid, public.member_role)               from public, anon, authenticated;
revoke execute on function public.issue_reset_token(uuid, uuid)                              from public, anon, authenticated;
revoke execute on function public.redeem_reset_token(text, text)                             from public, anon, authenticated;
revoke execute on function public.set_member_role(uuid, uuid, public.member_role)            from public, anon, authenticated;
revoke execute on function public.remove_member(uuid, uuid)                                  from public, anon, authenticated;
revoke execute on function public.set_member_phone(uuid, text)                               from public, anon, authenticated;
revoke execute on function public.generate_training_series(uuid, timestamptz, int, text, text) from public, anon, authenticated;

-- Anonymous reach is exactly these three (AC3).
grant execute on function public.get_event_preview(uuid)        to anon, authenticated;
grant execute on function public.lookup_team_invite(text)       to anon, authenticated;
grant execute on function public.redeem_reset_token(text, text) to anon, authenticated;

grant execute on function public.team_member_directory(uuid)                                to authenticated;
grant execute on function public.get_team_invite(uuid, public.member_role)                  to authenticated;
grant execute on function public.join_team_by_token(text)                                   to authenticated;
grant execute on function public.join_team_by_event(uuid)                                   to authenticated;
grant execute on function public.create_team_invite(uuid, public.member_role)               to authenticated;
grant execute on function public.revoke_team_invite(uuid, public.member_role)               to authenticated;
grant execute on function public.issue_reset_token(uuid, uuid)                              to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.member_role)            to authenticated;
grant execute on function public.remove_member(uuid, uuid)                                  to authenticated;
grant execute on function public.set_member_phone(uuid, text)                               to authenticated;
grant execute on function public.generate_training_series(uuid, timestamptz, int, text, text) to authenticated;
