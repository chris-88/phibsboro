-- S20.2 — managers correct a player's name (Chris, 2026-09-30, feedback #7). The team sheet, roster
-- and every share read profiles.name; a typo at sign-up needs fixing. profiles.name is not
-- client-writable for another user, so this is a security-definer RPC, a sibling of set_member_phone
-- (D51) and set_member_role (D9).
--
-- Z1 (decided 2026-09-30): callable by an admin, OR a manager of any team the target is a member of.
-- Mirrors the on-behalf pattern. Validates 1-60 chars trimmed (the registration name bound); a bad
-- length raises not_authorised as the backstop, exactly as set_member_phone does for a bad number
-- (client zod is the first line). The profiles_name_check column guard (1-80) is the hard floor.
-- No audit row: the sibling member corrections keep no history either.
--
-- Idempotent: create or replace + idempotent grants, safe to re-run under `supabase db push`.

create or replace function public.set_member_name(p_user_id uuid, p_name text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or exists (
      select 1 from public.team_members tm
      where tm.user_id = p_user_id
        and public.is_team_manager(tm.team_id)
    )
  ) then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  if p_name is null or char_length(btrim(p_name)) < 1 or char_length(btrim(p_name)) > 60 then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;

  update public.profiles set name = btrim(p_name) where id = p_user_id;
end;
$$;

alter function public.set_member_name(uuid, text) owner to postgres;
revoke execute on function public.set_member_name(uuid, text) from public, anon, authenticated;
grant execute on function public.set_member_name(uuid, text) to authenticated;
