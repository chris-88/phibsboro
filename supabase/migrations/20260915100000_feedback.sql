-- S12.1 — in-app feedback (v1.2.0, W1/W2). A report tied to its reporter, triaged by admins in-app.
-- Insert-as-self; a user reads only their own; an admin reads all and resolves through an RPC. No
-- client UPDATE/DELETE policy, so a sent report cannot be altered from the browser. A GitHub-issue
-- mirror is a planned fast-follow and does not change this table.

create type public.feedback_category as enum ('bug', 'idea', 'other');
create type public.feedback_status as enum ('open', 'resolved');

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  category    public.feedback_category not null default 'other',
  message     text not null,
  context     jsonb,
  status      public.feedback_status not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  constraint feedback_message_len check (char_length(btrim(message)) between 1 and 2000)
);

-- The admin inbox lists open first, newest first (S12.3).
create index feedback_status_created_idx on public.feedback (status, created_at desc);

alter table public.feedback enable row level security;

-- A signed-in user files only as themselves; a forged user_id is refused, not rewritten (W2).
create policy feedback_insert_self on public.feedback
  for insert to authenticated
  with check (user_id = auth.uid());

-- A user reads only their own feedback; an admin reads every row (W2).
create policy feedback_select_own_or_admin on public.feedback
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- No update or delete policy: feedback is immutable from the client. The admin resolve goes through
-- resolve_feedback (security definer), so the write is auditable and never trusts the client.
create or replace function public.resolve_feedback(p_id uuid)
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
  update public.feedback
    set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  where id = p_id and status <> 'resolved';
end;
$$;

revoke execute on function public.resolve_feedback(uuid) from public, anon, authenticated;
grant execute on function public.resolve_feedback(uuid) to authenticated;
