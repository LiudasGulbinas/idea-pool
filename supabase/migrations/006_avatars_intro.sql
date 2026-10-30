-- Polish: profile pictures and the first-login intro video.

alter table public.members add column if not exists avatar_url text;
alter table public.members add column if not exists intro_seen_at timestamptz;

-- Profile pictures are public images (shown everywhere in the app); each member writes only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars: own folder upload" on storage.objects;
create policy "avatars: own folder upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_member_id()::text);
drop policy if exists "avatars: own folder replace" on storage.objects;
create policy "avatars: own folder replace" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_member_id()::text);
drop policy if exists "avatars: own folder delete" on storage.objects;
create policy "avatars: own folder delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = public.current_member_id()::text);

notify pgrst, 'reload schema';
