-- S18.2 — admin user management (Chris, 2026-09-16). Two admin-only capabilities the user manager
-- lacked: promote/demote another admin (profiles.is_admin, which is_admin() reads), and fully
-- delete a person (auth.users, cascading to their profile and every row keyed on it). Both go
-- through security-definer RPCs — profiles is not client-writable for is_admin, and auth.users is
-- off-limits to clients entirely — mirroring admin_set_membership (W6).

create or replace function public.admin_set_admin(p_user_id uuid, p_is_admin boolean)
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
  -- An admin cannot strip their own admin — a guard against locking oneself (or the club) out.
  if p_user_id = (select auth.uid()) and not p_is_admin then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  update public.profiles set is_admin = p_is_admin where id = p_user_id;
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
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
  -- An admin cannot delete their own account through the tool.
  if p_user_id = (select auth.uid()) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  -- Removing the auth account cascades: profiles (id references auth.users on delete cascade), then
  -- every row keyed on the profile — team_members, event_responses, attendance, event_squad,
  -- match_stats, feedback (all on delete cascade). created_by columns are set null (history stays).
  delete from auth.users where id = p_user_id;
end;
$$;

alter function public.admin_set_admin(uuid, boolean) owner to postgres;
alter function public.admin_delete_user(uuid) owner to postgres;
revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.admin_delete_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
