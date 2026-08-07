-- 0007 — Modération des vidéos, condition du feed public.
--
-- Le feed est désormais visible du monde entier (0006) : il faut un levier
-- immédiat pour retirer un contenu contraire à la charte sans le supprimer
-- (préservation pour la modération). `hidden` masque la vidéo partout ;
-- seuls modérateurs et admins peuvent la basculer.

alter table public.videos add column if not exists hidden boolean not null default false;

create policy "modérer une vidéo" on public.videos for update to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('moderateur', 'admin')
    )
  );

-- La vue publique exclut les vidéos masquées.
create or replace view public.videos_feed as
select
  v.id,
  v.storage_path,
  v.caption,
  v.verse_ref,
  v.type,
  v.amen_count,
  v.duration_s,
  v.created_at,
  p.username,
  p.display_name
from public.videos v
join public.profiles p on p.id = v.author_id
where not v.hidden;
