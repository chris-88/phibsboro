-- S16.1 — profile photos (v1.2.0, W10). A public-read Storage bucket, a profiles.avatar_path pointer,
-- and a security-definer RPC so a user sets only their own photo (the direct profiles UPDATE stays
-- closed, keeping name/phone admin-controlled). Storage RLS scopes writes to the uploader's own uid
-- prefix; reads are public (bucket.public = true), so the app derives the URL with no signed-URL churn.

alter table public.profiles add column avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Writes only under {auth.uid()}/… ; a forged prefix is refused. Read needs no policy (public bucket).
create policy "avatars insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.set_own_avatar(p_path text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'not_authorised';
  end if;
  update public.profiles set avatar_path = p_path where id = auth.uid();
end;
$$;

revoke execute on function public.set_own_avatar(text) from public, anon;
grant execute on function public.set_own_avatar(text) to authenticated;
