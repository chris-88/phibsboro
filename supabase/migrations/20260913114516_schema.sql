-- S1.1 — the schema. Eight tables, four enums, keys, foreign keys, checks, indexes, the
-- updated_at trigger, and RLS enabled everywhere with no policies (deny-all until S1.3).
-- Written from spec/data-model.md; where anything here and that file disagree, that file wins
-- and the fix is a new migration, never an edit to this one (supabase/migrations/README.md).

-- gen_random_bytes for the S1.3 token RPCs. Already present on hosted projects; kept so a bare
-- local reset has it too.
create extension if not exists pgcrypto with schema extensions;

-- Enums, so the generated types are unions rather than string (D24). member_role has no
-- admin: admin is profiles.is_admin (D2).
create type public.event_type            as enum ('training', 'match');
create type public.event_status          as enum ('scheduled', 'cancelled');
create type public.availability_response as enum ('available', 'unavailable');
create type public.member_role           as enum ('player', 'manager');

-- profiles.id is the auth.users id (D4). Every other user-referencing column targets this
-- table, never auth.users.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  phone      text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Teams are never hard deleted: every FK to teams restricts (D31).
create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index teams_name_key on public.teams (lower(btrim(name)));

create table public.team_members (
  team_id   uuid not null references public.teams (id)    on delete restrict,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      public.member_role not null default 'player',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);

-- Join links. No client can select this table; the token is plaintext by design (D62).
create table public.team_invites (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete restrict,
  token      text not null unique,
  role       public.member_role not null,
  active     boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
-- At most one live link per team per role (D28).
create unique index team_invites_one_live_idx
  on public.team_invites (team_id, role) where active;

-- One-time password reset links. Same reachability as team_invites.
create table public.reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  team_id    uuid not null references public.teams (id)    on delete restrict,
  token      text not null unique,
  issued_at  timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at    timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null
);
create index reset_tokens_live_idx on public.reset_tokens (user_id)
  where used_at is null and revoked_at is null;

-- events.id is a bearer join credential, so it is a random uuid and nothing shorter (D6).
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete restrict,
  type       public.event_type not null,
  title      text not null check (char_length(btrim(title))    between 1 and 80),
  location   text not null check (char_length(btrim(location)) between 1 and 120),
  notes      text check (notes is null or char_length(notes) <= 500),
  starts_at  timestamptz not null,
  status     public.event_status not null default 'scheduled',
  series_id  uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_team_starts_idx on public.events (team_id, starts_at);
-- Makes the S4.6 generator idempotent; hand-created events are exempt (D30).
create unique index events_series_slot_idx
  on public.events (team_id, starts_at) where series_id is not null;

-- Absence of a row means awaiting (D25).
create table public.event_responses (
  event_id   uuid not null references public.events (id)   on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  response   public.availability_response not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index event_responses_user_idx on public.event_responses (user_id);

-- Absence of a row means not recorded (D25).
create table public.attendance (
  event_id    uuid not null references public.events (id)   on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  attended    boolean not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index attendance_user_idx on public.attendance (user_id);

-- updated_at. Runs as the writer and touches only new; not security definer.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create trigger event_responses_set_updated_at
  before update on public.event_responses
  for each row execute function public.set_updated_at();

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- Deny-all. RLS on everywhere, no policies until S1.3. Not `force`: the S1.3 RPCs are security
-- definer owned by postgres, the table owner, and forcing would apply policies to them (D54).
alter table public.profiles        enable row level security;
alter table public.teams           enable row level security;
alter table public.team_members    enable row level security;
alter table public.team_invites    enable row level security;
alter table public.reset_tokens    enable row level security;
alter table public.events          enable row level security;
alter table public.event_responses enable row level security;
alter table public.attendance      enable row level security;

-- Belt and braces on the two tables that are RPC-only forever (D54).
revoke all on public.team_invites from anon, authenticated;
revoke all on public.reset_tokens from anon, authenticated;
