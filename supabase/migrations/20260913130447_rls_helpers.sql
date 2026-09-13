-- S1.3 — RLS helpers. Five security-definer predicates the policies and RPCs are written in
-- terms of, plus the token generator. Every membership or management test in a policy goes
-- through is_team_member / is_team_manager and nothing else (AC4).
--
-- Security definer matters twice over. It lets a policy on events consult team_members without
-- that table's own policy getting in the way, and it breaks the events <-> event_responses cycle
-- that inline exists() clauses would create ("infinite recursion detected in policy"). Do not
-- fold event_team_id or has_event_row back into the policies.
--
-- Postgres evaluates a policy's function calls as the querying role, so `authenticated` needs
-- execute on the five predicates or every read fails with 42501 (proved on the hosted project
-- before this was written). They therefore appear on the PostgREST RPC surface; each answers
-- only about the caller, or returns a team_id that get_event_preview already hands to anon.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = (select auth.uid())
  );
$$;

-- True for an admin on every team, so no policy needs a separate admin branch for event writes.
create or replace function public.is_team_manager(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id
      and m.user_id = (select auth.uid())
      and m.role = 'manager'
  );
$$;

-- The event's team, read past RLS. Used by the response and attendance policies.
create or replace function public.event_team_id(p_event_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.team_id from public.events e where e.id = p_event_id;
$$;

-- "I hold a row for this event", read past RLS. D33: a leaver keeps their own history.
create or replace function public.has_event_row(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_responses r
    where r.event_id = p_event_id and r.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.attendance a
    where a.event_id = p_event_id and a.user_id = (select auth.uid())
  );
$$;

-- 32 random bytes as 43 characters of base64url (D5). S1.4 asserts the length.
create or replace function public.new_token()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

alter function public.is_admin()                 owner to postgres;
alter function public.is_team_member(uuid)       owner to postgres;
alter function public.is_team_manager(uuid)      owner to postgres;
alter function public.event_team_id(uuid)        owner to postgres;
alter function public.has_event_row(uuid)        owner to postgres;
alter function public.new_token()                owner to postgres;

-- The platform's default ACL hands execute to anon, authenticated and service_role on every new
-- function. Start from nothing, then grant only what the policies need.
revoke execute on function public.is_admin()            from public, anon, authenticated;
revoke execute on function public.is_team_member(uuid)  from public, anon, authenticated;
revoke execute on function public.is_team_manager(uuid) from public, anon, authenticated;
revoke execute on function public.event_team_id(uuid)   from public, anon, authenticated;
revoke execute on function public.has_event_row(uuid)   from public, anon, authenticated;
revoke execute on function public.new_token()           from public, anon, authenticated, service_role;

grant execute on function public.is_admin()            to authenticated;
grant execute on function public.is_team_member(uuid)  to authenticated;
grant execute on function public.is_team_manager(uuid) to authenticated;
grant execute on function public.event_team_id(uuid)   to authenticated;
grant execute on function public.has_event_row(uuid)   to authenticated;
