-- 0015 — Garde-fous approuvés avant cadrage mineurs/mentorat et pipeline média.
-- Aucune donnée n'est supprimée ; seules les nouvelles interactions à risque
-- sont suspendues jusqu'à validation d'un cadre produit et opérationnel.

-- Mentorat : cacher l'annuaire, empêcher nouvelles offres et nouvelles mises
-- en relation. Chaque membre conserve la possibilité de retirer sa propre offre
-- lorsque les écritures seront de nouveau ouvertes par une décision dédiée.
drop policy if exists "offres lisibles" on public.mentor_offers;
create policy "lire sa propre offre mentor" on public.mentor_offers for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "s'offrir mentor" on public.mentor_offers;
drop policy if exists "mettre à jour son offre mentor" on public.mentor_offers;
drop policy if exists "proposer mentorat" on public.mentorships;
drop policy if exists "maj mentorat" on public.mentorships;
revoke insert, update on public.mentor_offers from authenticated;
revoke insert, update on public.mentorships from authenticated;

-- Médias : suspendre tout nouveau dépôt et toute nouvelle métadonnée publique.
-- Les objets et vidéos existants restent lisibles selon les policies précédentes.
drop policy if exists "publier une vidéo" on public.videos;
revoke insert on public.videos from authenticated;
drop policy if exists "videos depot dans son dossier" on storage.objects;
drop policy if exists "videos mise à jour de ses fichiers" on storage.objects;
drop policy if exists "videos suppression de ses fichiers" on storage.objects;
revoke insert, update, delete on storage.objects from authenticated;
