-- S20.3 — injury status (Chris, 2026-09-30, feedback #4). A player can be marked injured, by
-- themselves or a manager of their team, with an expected return date and a short note. Z2: purely
-- informational for v1 — it does not change availability or squad selection. One current record per
-- player: a row means "currently injured", no row means fit (the event_responses "absence is a
-- state" pattern). Updates edit the row; recovery deletes it.
--
-- Reads go direct through RLS (a manager can't select another profile, but may read the injuries of
-- players on teams they manage — so this is its own table, not a profiles column). Writes go through
-- security-definer RPCs, the sibling of set_member_name/set_member_phone. Idempotent throughout.

create table if not exists public.player_injuries (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  expected_return date,
  note            text,
  updated_by      uuid references public.profiles(id) on delete set null,
  updated_at      timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'player_injuries_note_check'
      and conrelid = 'public.player_injuries'::regclass
  ) then
    alter table public.player_injuries
      add constraint player_injuries_note_check
      check (note is null or char_length(btrim(note)) <= 200);
  end if;
end $$;

alter table public.player_injuries enable row level security;

-- Read: the player themselves, an admin, or a manager of any team the player is on. No write
-- policies and no write grant — every write is a security-definer RPC below.
drop policy if exists player_injuries_select on public.player_injuries;
create policy player_injuries_select on public.player_injuries
  for select using (
    user_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.team_members tm
      where tm.user_id = player_injuries.user_id
        and public.is_team_manager(tm.team_id)
    )
  );

revoke all on public.player_injuries from public, anon, authenticated;
grant select on public.player_injuries to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Writes: self, a manager of a team the player is on, or an admin (Z2). Same guard as
-- set_member_name. set_injury upserts the current record; clear_injury removes it (recovered).
-- ---------------------------------------------------------------------------------------------

-- The two detail params default null so the generated client Args make them optional (Supabase does
-- not reflect param nullability otherwise); an omitted arg becomes null, which clears that field.
create or replace function public.set_injury(
  p_user_id uuid,
  p_expected_return date default null,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (
    p_user_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.team_members tm
      where tm.user_id = p_user_id
        and public.is_team_manager(tm.team_id)
    )
  ) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  if p_note is not null and char_length(btrim(p_note)) > 200 then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  insert into public.player_injuries (user_id, expected_return, note, updated_by, updated_at)
  values (p_user_id, p_expected_return, nullif(btrim(p_note), ''), (select auth.uid()), now())
  on conflict (user_id) do update
    set expected_return = excluded.expected_return,
        note            = excluded.note,
        updated_by      = excluded.updated_by,
        updated_at      = now();
end;
$$;

create or replace function public.clear_injury(p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (
    p_user_id = (select auth.uid())
    or public.is_admin()
    or exists (
      select 1 from public.team_members tm
      where tm.user_id = p_user_id
        and public.is_team_manager(tm.team_id)
    )
  ) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  delete from public.player_injuries where user_id = p_user_id;
end;
$$;

alter function public.set_injury(uuid, date, text) owner to postgres;
alter function public.clear_injury(uuid) owner to postgres;
revoke execute on function public.set_injury(uuid, date, text) from public, anon, authenticated;
revoke execute on function public.clear_injury(uuid) from public, anon, authenticated;
grant execute on function public.set_injury(uuid, date, text) to authenticated;
grant execute on function public.clear_injury(uuid) to authenticated;
