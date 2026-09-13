-- S1.3 — table privileges and row-level security policies. Written from the access matrix in
-- spec/data-model.md. RLS was enabled on all eight tables in S1.1; this file adds the policies.
--
-- Privilege and policy are both required: a policy without the grant is a 42501, a grant without
-- a policy is zero rows. The delete grants on events and event_responses exist so the admin
-- policies can use them; a manager's delete hits no policy and reports zero rows, not an error.
--
-- auth.uid() is always written (select auth.uid()) so the planner evaluates it once per
-- statement rather than once per row.

-- Start from nothing. The platform's default ACL granted every privilege to anon and
-- authenticated on every table S1.1 created.
revoke all on all tables in schema public from anon, authenticated;

grant select                         on public.profiles        to authenticated;
grant select                         on public.teams           to authenticated;
grant select                         on public.team_members    to authenticated;
grant select, insert, update, delete on public.events          to authenticated;
grant select, insert, update, delete on public.event_responses to authenticated;
grant select, insert, update, delete on public.attendance      to authenticated;
-- team_invites and reset_tokens: nothing, to anybody. anon: nothing, on anything.

-- profiles (D8). Own row only, for everyone, admins included. No insert, update or delete
-- policy at all: the S1.2 trigger and set_member_phone are security definer.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- teams (D8, D50). No delete policy: teams are never hard deleted.
create policy teams_select_member on public.teams
  for select to authenticated
  using ((public.is_team_member(id) and active) or public.is_admin());

create policy teams_insert_admin on public.teams
  for insert to authenticated
  with check (public.is_admin());

create policy teams_update_admin on public.teams
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- team_members (D9). Read only, ever. Every write goes through an RPC.
create policy team_members_select_team on public.team_members
  for select to authenticated
  using (public.is_team_member(team_id) or public.is_admin());

-- events (D31, D33, D50)
create policy events_select on public.events
  for select to authenticated
  using (public.is_team_member(team_id) or public.is_admin() or public.has_event_row(id));

create policy events_insert_manager on public.events
  for insert to authenticated
  with check (
    public.is_team_manager(team_id)
    and exists (select 1 from public.teams t where t.id = team_id and t.active)
  );

create policy events_update_manager on public.events
  for update to authenticated
  using (public.is_team_manager(team_id))
  with check (public.is_team_manager(team_id));

create policy events_delete_admin on public.events
  for delete to authenticated
  using (public.is_admin());

-- event_responses (D12, D32, D33, D61). Permissive policies OR together: select_own and
-- select_manager coexist without either widening the other. The insert and update checks must
-- stay byte-identical; if they drift, a player can edit a row they could not have created.
create policy event_responses_select_own on public.event_responses
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy event_responses_select_manager on public.event_responses
  for select to authenticated
  using (public.is_team_manager(public.event_team_id(event_id)));

create policy event_responses_insert_own on public.event_responses
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status = 'scheduled'
        and e.starts_at > now()
        and public.is_team_member(e.team_id)
    )
  );

create policy event_responses_update_own on public.event_responses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status = 'scheduled'
        and e.starts_at > now()
        and public.is_team_member(e.team_id)
    )
  );

create policy event_responses_admin_all on public.event_responses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
-- No delete policy for players or managers (D61, A2).

-- attendance (D25, D32, D33). recorded_by must be the writer, so S4.5 always sends it.
create policy attendance_select_own on public.attendance
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy attendance_manager_all on public.attendance
  for all to authenticated
  using (public.is_team_manager(public.event_team_id(event_id)))
  with check (
    public.is_team_manager(public.event_team_id(event_id))
    and recorded_by = (select auth.uid())
  );
