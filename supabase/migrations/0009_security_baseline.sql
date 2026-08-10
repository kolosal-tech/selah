-- 0009 — Verrouillage des champs privilégiés, prières anonymes et médias.

-- Les profils sont créés par le trigger handle_new_user. Un client ne doit
-- jamais pouvoir créer une ligne de profil ni modifier rôle, séries ou charte.
drop policy if exists "chacun crée son profil" on public.profiles;
drop policy if exists "chacun modifie son profil" on public.profiles;
create policy "chacun modifie ses préférences" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke insert on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, country, lang, church_id, sabbath_until)
  on public.profiles to authenticated;

-- La table source conserve author_id pour les actions du propriétaire, mais
-- elle ne doit pas être lisible par les autres membres. La vue ne révèle une
-- identité que lorsque la demande n'est pas anonyme.
drop policy if exists "requêtes lisibles" on public.prayer_requests;
revoke select on public.prayer_requests from anon, authenticated;

create or replace view public.prayer_requests_public
with (security_barrier = true) as
select
  r.id,
  r.body,
  r.anonymous,
  r.country,
  r.pray_count,
  r.answered,
  r.created_at,
  case when r.anonymous then null else p.username end as username
from public.prayer_requests r
join public.profiles p on p.id = r.author_id;

revoke all on public.prayer_requests_public from anon;
grant select on public.prayer_requests_public to authenticated;

-- Une vidéo masquée ne doit plus être récupérable par une requête brute.
drop policy if exists "vidéos lisibles" on public.videos;
create policy "vidéos visibles ou détenues" on public.videos for select to authenticated
  using (
    not hidden
    or author_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  );

-- L'application publie exclusivement les métadonnées saisies ou mesurées.
-- Les compteurs, l'état de modération et l'horodatage restent des valeurs
-- système : aucun INSERT direct ne peut les fixer ou les anticiper.
revoke insert on public.videos from anon, authenticated;
grant insert (author_id, storage_path, thumb_path, caption, verse_ref, type, duration_s)
  on public.videos to authenticated;

-- Le bucket passe en privé. Les objets publiés sont lisibles par les membres
-- via URL signée, sauf si la vidéo est masquée ; l'auteur et la modération
-- conservent l'accès à leurs éléments.
update storage.buckets set public = false where id = 'videos';
drop policy if exists "videos lecture publique" on storage.objects;
create policy "videos lecture autorisée" on storage.objects for select to authenticated
  using (
    bucket_id = 'videos'
    and exists (
      select 1
      from public.videos v
      where (v.storage_path = name or v.thumb_path = name)
        and (
          not v.hidden
          or v.author_id = auth.uid()
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('moderateur', 'admin')
          )
        )
    )
  );

-- Un auteur peut reprendre exactement son dépôt interrompu, mais seulement
-- dans son propre dossier. Cela permet des uploads idempotents sans ouvrir
-- la modification des objets d'un autre membre.
drop policy if exists "videos mise à jour de ses fichiers" on storage.objects;
create policy "videos mise à jour de ses fichiers" on storage.objects for update to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Une salle fermée ne reçoit plus de nouveau message, y compris via Realtime.
drop policy if exists "écrire dans la salle" on public.room_messages;
create policy "écrire dans une salle ouverte" on public.room_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.closed_at is null
    )
  );
