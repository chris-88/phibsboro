-- S18.4 — a mandatory reason when a player says they can't make it (Chris, 2026-09-16). Stored on
-- the response and required (non-empty) for 'unavailable', absent for 'available'. The check is NOT
-- VALID so it governs new and edited responses without rejecting the reason-less rows already there.
-- Idempotent (add-if-not-exists / drop-if-exists) so a pre-apply and the deploy's re-apply agree.

alter table public.event_responses add column if not exists reason text;

alter table public.event_responses drop constraint if exists event_responses_reason_ck;
alter table public.event_responses
  add constraint event_responses_reason_ck check (
    -- `reason is not null` is explicit so `(unavailable, null)` evaluates to FALSE, not NULL: a
    -- CHECK only rejects a FALSE, and `btrim(null) <> ''` alone would be NULL and slip through.
    (response = 'available' and reason is null)
    or (
      response = 'unavailable'
      and reason is not null
      and btrim(reason) <> ''
      and char_length(reason) <= 200
    )
  ) not valid;

-- The manager on-behalf write (S18.1) carries the reason too, since the check requires one for
-- 'unavailable'. Replace the 3-arg RPC with a 4-arg one: available stores null, unavailable the
-- reason. `p_reason` defaults null so an availability call needs no fourth argument.
drop function if exists public.set_response_for(uuid, uuid, public.availability_response);
drop function if exists public.set_response_for(uuid, uuid, public.availability_response, text);

create function public.set_response_for(
  p_event_id uuid,
  p_user_id uuid,
  p_response public.availability_response,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (public.is_team_manager(public.event_team_id(p_event_id)) or public.is_admin()) then
    raise exception 'not_authorised';
  end if;
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
  insert into public.event_responses (event_id, user_id, response, reason)
  values (
    p_event_id,
    p_user_id,
    p_response,
    case when p_response = 'unavailable' then p_reason else null end
  )
  on conflict (event_id, user_id) do update
    set response = excluded.response, reason = excluded.reason;
end;
$$;

alter function public.set_response_for(uuid, uuid, public.availability_response, text) owner to postgres;
revoke execute on function public.set_response_for(uuid, uuid, public.availability_response, text)
  from public, anon;
grant execute on function public.set_response_for(uuid, uuid, public.availability_response, text)
  to authenticated;
