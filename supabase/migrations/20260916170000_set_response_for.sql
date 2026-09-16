-- S18.1 — a manager records a player's availability on their behalf (Chris, 2026-09-16). A player
-- texts "I'm in" but never taps; the manager sets it from the event's "Who's in" list. The
-- event_responses table policies stay player-only (a manager cannot write the table directly); this
-- one security-definer RPC is the manager's single audited way in, mirroring the squad/reset RPCs.

create or replace function public.set_response_for(
  p_event_id uuid,
  p_user_id uuid,
  p_response public.availability_response
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only a manager of the event's team (or an admin) may set someone else's availability.
  if not (public.is_team_manager(public.event_team_id(p_event_id)) or public.is_admin()) then
    raise exception 'not_authorised';
  end if;

  -- The subject must belong to the event's team, and availability closes at kick-off — the same
  -- window the player's own D12 policy enforces (after kick-off a manager records attendance, not
  -- availability). Both refusals raise 'not_authorised'; the UI only offers this while it is open.
  if not exists (
    select 1
    from public.events e
    join public.team_members tm on tm.team_id = e.team_id and tm.user_id = p_user_id
    where e.id = p_event_id
      and e.status = 'scheduled'
      and e.starts_at > now()
  ) then
    raise exception 'not_authorised';
  end if;

  insert into public.event_responses (event_id, user_id, response)
  values (p_event_id, p_user_id, p_response)
  on conflict (event_id, user_id) do update set response = excluded.response;
end;
$$;

alter function public.set_response_for(uuid, uuid, public.availability_response) owner to postgres;
revoke execute on function public.set_response_for(uuid, uuid, public.availability_response) from public, anon;
grant execute on function public.set_response_for(uuid, uuid, public.availability_response) to authenticated;
