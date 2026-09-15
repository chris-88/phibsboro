-- S14.1 — admin_set_membership (v1.2.0, W6). team_members is RPC-only (the sole policy is SELECT;
-- there is no client write path), and joins go through join_team_by_token/_by_event which only
-- upgrade a role. This admin-only RPC lets an admin assign a user to any team and set the exact
-- role (up OR down) — the repair tool of W6. Role changes/removal reuse set_member_role /
-- remove_member; this adds only the direct assign.

create or replace function public.admin_set_membership(
  p_team_id uuid,
  p_user_id uuid,
  p_role public.member_role
)
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
  insert into public.team_members (team_id, user_id, role)
  values (p_team_id, p_user_id, p_role)
  on conflict on constraint team_members_pkey do update set role = excluded.role;
end;
$$;

revoke execute on function public.admin_set_membership(uuid, uuid, public.member_role)
  from public, anon, authenticated;
grant execute on function public.admin_set_membership(uuid, uuid, public.member_role)
  to authenticated;
