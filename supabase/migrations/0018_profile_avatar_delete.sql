-- 0018 — Suppression bornée de la photo du propriétaire.
drop policy if exists "avatars suppression propriétaire" on storage.objects;
create policy "avatars suppression propriétaire" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

grant delete on storage.objects to authenticated;
