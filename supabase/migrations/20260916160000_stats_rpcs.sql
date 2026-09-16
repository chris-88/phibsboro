-- S17.5/S17.6 — the two stats reads (v1.3.0, X6/X7/X8). Role-aware security-definer aggregates: a
-- team manager/admin gets every member's row, a player gets only their own, a non-member gets none.

-- Attendance over the team's PAST, scheduled events (X7): games (matches) vs training (training/social),
-- and the availability response rate. Counts are team-wide totals; a player's are their own.
create or replace function public.attendance_stats(p_team_id uuid)
returns table (
  user_id uuid, name text,
  games_total int, games_attended int,
  training_total int, training_attended int,
  responded int, invited int
)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select (public.is_team_manager(p_team_id) or public.is_admin()) as mgr
  ),
  members as (
    select tm.user_id, p.name
    from public.team_members tm
    join public.profiles p on p.id = tm.user_id
    where tm.team_id = p_team_id
      and ((select mgr from allowed) or tm.user_id = auth.uid())
  ),
  past as (
    select e.id, e.type
    from public.events e
    where e.team_id = p_team_id and e.status = 'scheduled' and e.starts_at < now()
  )
  select
    m.user_id, m.name,
    count(*) filter (where pe.type = 'match')::int,
    count(*) filter (where pe.type = 'match' and a.attended)::int,
    count(*) filter (where pe.type in ('training','social'))::int,
    count(*) filter (where pe.type in ('training','social') and a.attended)::int,
    count(*) filter (where r.event_id is not null)::int,
    count(pe.id)::int
  from members m
  left join past pe on true
  left join public.attendance a on a.event_id = pe.id and a.user_id = m.user_id
  left join public.event_responses r on r.event_id = pe.id and r.user_id = m.user_id
  group by m.user_id, m.name;
$$;

-- Performance: aggregate match_stats over the team's matches, plus MOTM from events (X8).
create or replace function public.performance_stats(p_team_id uuid)
returns table (
  user_id uuid, name text,
  appearances int, goals int, assists int,
  yellow_cards int, red_cards int, minutes int, motm int
)
language sql
stable
security definer
set search_path = ''
as $$
  with allowed as (
    select (public.is_team_manager(p_team_id) or public.is_admin()) as mgr
  ),
  members as (
    select tm.user_id, p.name
    from public.team_members tm
    join public.profiles p on p.id = tm.user_id
    where tm.team_id = p_team_id
      and ((select mgr from allowed) or tm.user_id = auth.uid())
  ),
  matches as (
    select e.id, e.motm_user_id
    from public.events e
    where e.team_id = p_team_id and e.type = 'match' and e.status = 'scheduled'
  )
  select
    m.user_id, m.name,
    count(ms.event_id)::int,
    coalesce(sum(ms.goals), 0)::int,
    coalesce(sum(ms.assists), 0)::int,
    coalesce(sum(ms.yellow_cards), 0)::int,
    count(*) filter (where ms.red_card)::int,
    coalesce(sum(ms.minutes), 0)::int,
    count(*) filter (where mt.motm_user_id = m.user_id)::int
  from members m
  left join matches mt on true
  left join public.match_stats ms on ms.event_id = mt.id and ms.user_id = m.user_id
  group by m.user_id, m.name;
$$;

revoke execute on function public.attendance_stats(uuid) from public, anon;
grant execute on function public.attendance_stats(uuid) to authenticated;
revoke execute on function public.performance_stats(uuid) from public, anon;
grant execute on function public.performance_stats(uuid) to authenticated;
