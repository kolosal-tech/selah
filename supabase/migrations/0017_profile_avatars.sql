-- 0017 — Photo de profil privée, modifiable par son propriétaire.
alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars lecture propriétaire" on storage.objects;
create policy "avatars lecture propriétaire" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars dépôt propriétaire" on storage.objects;
create policy "avatars dépôt propriétaire" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars remplacement propriétaire" on storage.objects;
create policy "avatars remplacement propriétaire" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

grant select, insert, update on storage.objects to authenticated;
grant update (avatar_path) on public.profiles to authenticated;
