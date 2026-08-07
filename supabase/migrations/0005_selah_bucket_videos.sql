-- Bucket des mini-vidéos verticales.
-- Public en lecture (le contenu est destiné à être vu), écriture strictement
-- limitée : chaque membre n'écrit que dans son propre dossier <uid>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "videos lecture publique" on storage.objects;
create policy "videos lecture publique" on storage.objects
  for select using (bucket_id = 'videos');

drop policy if exists "videos depot dans son dossier" on storage.objects;
create policy "videos depot dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "videos suppression de ses fichiers" on storage.objects;
create policy "videos suppression de ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
