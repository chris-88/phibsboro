-- Epic 19 (Y1) — subs (fees/membership) tracking (Chris, 2026-09-17). Owner override of CLAUDE.md's
-- "payments/fees out of scope" line, the way stats (X1) and team selection (V1) were brought in. The
-- app only TRACKS subs and links out to an admin-set pay link for collection — it never handles money.
--
-- One club-wide amount everyone owes (Y1) lives on a singleton `club_settings` row with the pay link.
-- Payments are part-payments recorded by an admin into `subs_payments`; a player's outstanding is the
-- amount minus their total paid, derived, never stored. Idempotent so a pre-apply and the deploy agree.

create table if not exists public.club_settings (
  id           boolean primary key default true,
  subs_amount  numeric(10, 2) not null default 0 check (subs_amount >= 0),
  pay_link     text check (pay_link is null or char_length(pay_link) <= 500),
  updated_at   timestamptz not null default now(),
  -- One row only: the id can only ever be true.
  constraint club_settings_singleton check (id)
);
insert into public.club_settings (id) values (true) on conflict (id) do nothing;

alter table public.club_settings enable row level security;
-- Everyone signed in reads it (a player needs the amount + pay link); only an admin writes.
drop policy if exists club_settings_read on public.club_settings;
create policy club_settings_read on public.club_settings for select to authenticated using (true);
drop policy if exists club_settings_update_admin on public.club_settings;
create policy club_settings_update_admin on public.club_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop trigger if exists club_settings_set_updated_at on public.club_settings;
create trigger club_settings_set_updated_at before update on public.club_settings
  for each row execute function set_updated_at();

grant select, update on public.club_settings to authenticated;

-- One row per part-payment (Y2). Admins write; a player reads their own, a manager reads the rows of
-- members on a team they manage (so the "who has paid" list works), an admin reads all.
create table if not exists public.subs_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  amount       numeric(10, 2) not null check (amount > 0),
  note         text check (note is null or char_length(note) <= 200),
  recorded_by  uuid references public.profiles (id),
  recorded_at  timestamptz not null default now()
);
create index if not exists subs_payments_user_idx on public.subs_payments (user_id);

alter table public.subs_payments enable row level security;

-- Admins do everything (this USING also grants them SELECT of every row).
drop policy if exists subs_payments_admin_all on public.subs_payments;
create policy subs_payments_admin_all on public.subs_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Read: the payer themselves, or a manager of any team the payer is a member of.
drop policy if exists subs_payments_read on public.subs_payments;
create policy subs_payments_read on public.subs_payments for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.team_members tm
    where tm.user_id = subs_payments.user_id
      and public.is_team_manager(tm.team_id)
  )
);

grant select, insert, update, delete on public.subs_payments to authenticated;
