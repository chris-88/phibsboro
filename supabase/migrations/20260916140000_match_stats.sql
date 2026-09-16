-- S17.3 — match stats (v1.3.0, X4/X6/X8). One row per player per match, plus MOTM and final score on
-- the event. Managers of the team (or admin) write and read all; a player reads only their own row.

create table public.match_stats (
  event_id     uuid not null references public.events (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  goals        int not null default 0 check (goals >= 0),
  assists      int not null default 0 check (assists >= 0),
  yellow_cards int not null default 0 check (yellow_cards between 0 and 2),
  red_card     boolean not null default false,
  minutes      int check (minutes is null or minutes between 0 and 200),
  recorded_by  uuid references public.profiles (id),
  updated_at   timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index match_stats_user_idx on public.match_stats (user_id);

create trigger match_stats_set_updated_at before update on public.match_stats
  for each row execute function set_updated_at();

alter table public.match_stats enable row level security;

-- Managers of the event's team (or an admin) can do everything; the USING also grants them SELECT.
create policy match_stats_manage on public.match_stats for all to authenticated
  using (public.is_team_manager(public.event_team_id(event_id)) or public.is_admin())
  with check (public.is_team_manager(public.event_team_id(event_id)) or public.is_admin());

-- A player reads only their own row (X8); they hold no write policy, so they cannot write.
create policy match_stats_read_own on public.match_stats for select to authenticated
  using (user_id = auth.uid());

-- MOTM and final score live on the event (X4), match-only.
alter table public.events add column motm_user_id uuid references public.profiles (id);
alter table public.events add column score_us int;
alter table public.events add column score_them int;
alter table public.events add constraint events_motm_match_only check (motm_user_id is null or type = 'match');
alter table public.events add constraint events_score_us_check check (score_us is null or (type = 'match' and score_us >= 0));
alter table public.events add constraint events_score_them_check check (score_them is null or (type = 'match' and score_them >= 0));
