-- S18.6 — a lightweight last-active stamp (Chris, 2026-09-16). last_sign_in_at (S18.5) only marks the
-- login moment; this tracks ongoing use. `profiles.last_seen_at` is bumped by `touch_last_seen()` as
-- the user navigates — the client throttles it to at most once every few minutes, so it is one cheap
-- single-row update, not a write per action. The admin Users screen shows the later of this and the
-- login time as "Last active". Idempotent so a pre-apply and the deploy's re-apply agree.

alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Security definer so a user can stamp only their OWN last_seen_at without a broad profiles
-- self-update policy (which would also let them edit name/phone/is_admin). Writes nothing else.
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set last_seen_at = now() where id = (select auth.uid());
$$;

alter function public.touch_last_seen() owner to postgres;
revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
