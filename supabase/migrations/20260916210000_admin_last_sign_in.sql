-- S18.5 — last sign-in on the admin user manager (Chris, 2026-09-16). auth.users.last_sign_in_at is
-- off-limits to clients, so an admin-only security-definer RPC returns it per user; the screen joins
-- it to the directory. Role-gated in the body (the same shape as the stats RPCs): an admin gets
-- every row, anyone else gets none.

create or replace function public.admin_last_sign_in()
returns table (user_id uuid, last_sign_in_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.last_sign_in_at
  from auth.users u
  where public.is_admin()
$$;

alter function public.admin_last_sign_in() owner to postgres;
revoke execute on function public.admin_last_sign_in() from public, anon;
grant execute on function public.admin_last_sign_in() to authenticated;
