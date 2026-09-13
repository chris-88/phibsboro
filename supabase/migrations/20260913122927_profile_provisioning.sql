-- S1.2 — profile provisioning. One profiles row per auth user, written by this trigger and by
-- nothing else (D4). Raises rather than papering over: a nameless or numberless signup is a
-- malformed client, and the raise rolls GoTrue's insert back so no auth user is left behind.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_phone text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), '');
  if v_name is null then
    raise exception 'profile_name_required' using errcode = '23514';
  end if;

  -- Supabase stores auth.users.phone without the leading '+' (D35). Under the D19
  -- fallback the column is null and the number arrives in metadata instead.
  v_phone := case
    when coalesce(new.phone, '') <> '' then '+' || new.phone
    else nullif(btrim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  end;

  if v_phone is null or v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'profile_phone_invalid' using errcode = '23514';
  end if;

  -- is_admin is never read from metadata; the column default is the only source (D2).
  insert into public.profiles (id, name, phone)
  values (new.id, left(v_name, 80), v_phone);

  return new;
exception
  -- profiles_phone_key is the only unique constraint this insert can breach: new.id is the
  -- auth.users row just created, so the primary key cannot collide.
  when unique_violation then
    raise exception 'phone_taken' using errcode = '23505';
end;
$$;

-- Fired by GoTrue as supabase_auth_admin. Nobody else has a reason to call it; a trigger
-- function cannot be called directly anyway, but the grant surface is kept explicit.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant  execute on function public.handle_new_user() to supabase_auth_admin;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
