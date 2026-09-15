-- Admins can read every profile (v1.2.0, W6). profiles had only a select-own policy, so names were
-- reachable only through security-definer RPCs (team_member_directory). The admin user manager
-- (S14.2) needs the whole directory (name + phone), and the feedback inbox (S12.3) embeds the
-- reporter's profile — both need an admin to read profiles they do not own. This adds that, matching
-- the is_admin() god-mode grants on the other tables (V14). Non-admins are unchanged: select-own only.
create policy profiles_select_admin on public.profiles
  for select to authenticated
  using (public.is_admin());
