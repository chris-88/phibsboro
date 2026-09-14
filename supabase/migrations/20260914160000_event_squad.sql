-- S9.1 — the matchday squad (V6). A team's picked side for one match: who is in, their shirt
-- number 1–20 and the single captain. Distinct from event_responses (availability) and attendance
-- (who turned up). RLS mirrors attendance (S4.5): a manager of the event's team (and admins)
-- writes, every team member reads their team's rows, anon nothing; recorded_by is the writer.
--
-- The V7 "available only" rule — a squad row for (event_id, user_id) needs an
-- event_responses.response='available' row — is enforced twice over. The direct PostgREST write
-- policy carries it in `with check` (via is_available_for), so even a manager's raw insert of a
-- non-available player is refused 42501. The set_squad_member RPC checks it explicitly first, so
-- the app gets one clean, column-free word (`not_available`) rather than a policy 42501 (AC3).
-- The app writes through the RPCs; the table policies are the backstop and what the by-SQL tests
-- hit. All errors stay in the six-word set plus three squad words (not_available, number_taken,
-- captain_taken), documented in S9.1's build notes.

-- —— 1. Table ————————————————————————————————————————————————————————————————
-- recorded_by is not null (AC6): the RPC always sets it to auth.uid(), and the write policy
-- refuses any other value. FKs cascade on delete of the event or either profile, so a deleted
-- event, squad member or manager takes its squad rows with it (AC5); removing a team_members row
-- touches nothing here, so a leaver's historic squad rows survive (D33, AC5).
create table public.event_squad (
  event_id     uuid        not null references public.events   (id) on delete cascade,
  user_id      uuid        not null references public.profiles (id) on delete cascade,
  shirt_number int         not null check (shirt_number between 1 and 20),
  is_captain   boolean     not null default false,
  recorded_by  uuid        not null references public.profiles (id) on delete cascade,
  updated_at   timestamptz not null default now(),
  primary key (event_id, user_id),
  unique (event_id, shirt_number)
);

-- At most one captain per event. A partial unique index — only the captain rows can collide.
create unique index event_squad_one_captain_idx
  on public.event_squad (event_id) where is_captain;

-- The per-event read behind the squad picker (S9.2) and the share (S9.3).
create index event_squad_event_idx on public.event_squad (event_id);

-- updated_at is stamped by the shared trigger on update, never sent by a client (mirrors S1.1).
create trigger event_squad_set_updated_at
  before update on public.event_squad
  for each row execute function public.set_updated_at();

alter table public.event_squad enable row level security;

-- —— 2. Grants ————————————————————————————————————————————————————————————————
-- Start from nothing, as S1.3 does, then grant only what the policies use. anon: nothing.
revoke all on public.event_squad from anon, authenticated;
grant select, insert, update, delete on public.event_squad to authenticated;

-- —— 3. The V7 pool predicate ——————————————————————————————————————————————————
-- Reads event_responses past RLS, so the write policy's available check does not depend on the
-- caller's own visibility of the response row and cannot recurse. Same shape and ACL as the S1.3
-- helpers: security definer, empty search_path, execute to authenticated only (a policy evaluates
-- its function calls as the querying role).
create or replace function public.is_available_for(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.event_responses r
    where r.event_id = p_event_id
      and r.user_id  = p_user_id
      and r.response = 'available'
  );
$$;

alter function public.is_available_for(uuid, uuid) owner to postgres;
revoke execute on function public.is_available_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_available_for(uuid, uuid) to authenticated;

-- —— 4. Policies ————————————————————————————————————————————————————————————————
-- Read: every team member (players included) reads their team's squad rows; an admin reads all.
create policy event_squad_select_member on public.event_squad
  for select to authenticated
  using (public.is_team_member(public.event_team_id(event_id)) or public.is_admin());

-- Write: a manager of the event's team (is_team_manager already covers admins). insert/update/
-- delete in one `for all` policy, exactly like attendance_manager_all, plus the two extra checks:
-- recorded_by must be the writer (AC6) and the subject must be an available responder (V7, AC3).
create policy event_squad_manager_write on public.event_squad
  for all to authenticated
  using (public.is_team_manager(public.event_team_id(event_id)))
  with check (
    public.is_team_manager(public.event_team_id(event_id))
    and recorded_by = (select auth.uid())
    and public.is_available_for(event_id, user_id)
  );

-- —— 5. RPCs ——————————————————————————————————————————————————————————————————
-- The app's write path (open question default: RPCs, for a clean single error and an atomic
-- multi-condition write). Security definer, so they run past RLS and do the authorisation
-- themselves — is_team_manager(event's team) exactly as the policy, then the V7 available check,
-- then the two uniqueness rules pre-checked for clean words (the unique indexes remain the
-- backstop under a race). Bad or out-of-range arguments raise not_authorised, matching the S1.3
-- argument-guard convention.

create or replace function public.set_squad_member(
  p_event_id     uuid,
  p_user_id      uuid,
  p_shirt_number int,
  p_is_captain   boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_team_id uuid;
begin
  v_team_id := public.event_team_id(p_event_id);
  if v_team_id is null or not public.is_team_manager(v_team_id) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  if p_shirt_number is null or p_shirt_number < 1 or p_shirt_number > 20 then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  if not public.is_available_for(p_event_id, p_user_id) then
    raise exception using errcode = 'P0001', message = 'not_available';
  end if;
  if exists (
    select 1 from public.event_squad s
    where s.event_id = p_event_id
      and s.shirt_number = p_shirt_number
      and s.user_id <> p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'number_taken';
  end if;
  if coalesce(p_is_captain, false) and exists (
    select 1 from public.event_squad s
    where s.event_id = p_event_id
      and s.is_captain
      and s.user_id <> p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'captain_taken';
  end if;

  insert into public.event_squad (event_id, user_id, shirt_number, is_captain, recorded_by)
  values (p_event_id, p_user_id, p_shirt_number, coalesce(p_is_captain, false), auth.uid())
  on conflict (event_id, user_id) do update
    set shirt_number = excluded.shirt_number,
        is_captain   = excluded.is_captain,
        recorded_by  = excluded.recorded_by;
  -- updated_at is the trigger's job on the conflict-update path; the insert path defaults it.
end;
$$;

create or replace function public.remove_squad_member(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_team_manager(public.event_team_id(p_event_id)) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  delete from public.event_squad where event_id = p_event_id and user_id = p_user_id;
end;
$$;

create or replace function public.clear_squad(p_event_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_team_manager(public.event_team_id(p_event_id)) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  delete from public.event_squad where event_id = p_event_id;
end;
$$;

alter function public.set_squad_member(uuid, uuid, int, boolean) owner to postgres;
alter function public.remove_squad_member(uuid, uuid)            owner to postgres;
alter function public.clear_squad(uuid)                          owner to postgres;

revoke execute on function public.set_squad_member(uuid, uuid, int, boolean)
  from public, anon, authenticated;
revoke execute on function public.remove_squad_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.clear_squad(uuid)              from public, anon, authenticated;

grant execute on function public.set_squad_member(uuid, uuid, int, boolean) to authenticated;
grant execute on function public.remove_squad_member(uuid, uuid)            to authenticated;
grant execute on function public.clear_squad(uuid)                          to authenticated;
