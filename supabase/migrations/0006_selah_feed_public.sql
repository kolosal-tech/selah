-- 0006 — Feed vidéo public (visiteurs non connectés).
--
-- Objectif : le feed vertical de la page d'accueil doit être lisible sans
-- compte, sans ouvrir les tables de base à `anon`. On expose une VUE aux
-- colonnes minimales ; `videos` et `profiles` gardent leurs policies
-- `to authenticated` intactes (leçon RLS : ne jamais élargir une table
-- entière pour un besoin d'affichage).
--
-- La vue est volontairement en mode « security definer » (défaut Postgres :
-- elle s'exécute avec les droits de son propriétaire, qui possède les tables
-- et passe donc au travers de leur RLS). C'est le point de passage contrôlé :
-- seules les colonnes listées ici sont visibles. L'advisor Supabase signalera
-- cette vue — c'est attendu et assumé.

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
join public.profiles p on p.id = v.author_id;

comment on view public.videos_feed is
  'Feed vidéo public : colonnes minimales, lecture seule, anon + authenticated.';

-- Lecture seule, pour tout le monde ; aucune écriture possible via la vue.
revoke all on public.videos_feed from anon, authenticated;
grant select on public.videos_feed to anon, authenticated;
