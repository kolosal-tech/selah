-- 0016 — Réouverture contrôlée après validation explicite.
-- Les limites serveur, RLS, modération, URLs signées et quotas restent actifs.

-- Mentorat : annuaire et écritures réouverts, uniquement pour des membres
-- authentifiés et sous policies propriétaires/participants.
drop policy if exists "lire sa propre offre mentor" on public.mentor_offers;
create policy "offres lisibles" on public.mentor_offers
  for select to authenticated using (true);
create policy "s'offrir mentor" on public.mentor_offers
  for insert to authenticated with check (user_id = auth.uid());
create policy "mettre à jour son offre mentor" on public.mentor_offers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
grant select, insert, update, delete on public.mentor_offers to authenticated;
grant select, insert, update on public.mentorships to authenticated;
create policy "proposer mentorat" on public.mentorships
  for insert to authenticated
  with check (mentor_id = auth.uid() or mentee_id = auth.uid());
create policy "maj mentorat" on public.mentorships
  for update to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid());

-- Vidéo : seules les colonnes autorisées par 0009 sont insérables ; les
-- compteurs, le masquage et les dates restent contrôlés par le serveur.
create policy "publier une vidéo" on public.videos
  for insert to authenticated with check (author_id = auth.uid());
grant insert (author_id, storage_path, thumb_path, caption, verse_ref, type, duration_s)
  on public.videos to authenticated;

-- Storage : dépôt, reprise idempotente et suppression limités au dossier UID.
create policy "videos depot dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos mise à jour de ses fichiers" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "videos suppression de ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
grant insert, update, delete on storage.objects to authenticated;
