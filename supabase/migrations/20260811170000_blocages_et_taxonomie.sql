-- Vague 1 — Trust & Safety : donner à un membre les moyens de se protéger
-- lui-même, sans dépendre d'un modérateur.
--
-- Aujourd'hui, la seule réponse offerte à une gêne est le signalement : un
-- geste qui demande à un tiers d'agir, sans effet immédiat pour celui qui le
-- pose. Trois gestes distincts manquent, et ils ne se valent pas :
--
--   `mute`             — je ne veux plus voir ce compte ; lui ne sait rien.
--   `block`            — je ne veux plus voir ce compte, et il ne peut plus
--                        me suivre.
--   `not_interested`   — je ne rejette pas ce compte, je veux moins le voir.
--
-- Aucune de ces trois décisions ne dépend d'un arbitrage produit bloqué : elles
-- ne touchent ni les mineurs, ni le mentorat, ni les paiements. Voir
-- `docs/adr/ADR-0002-moderation.md`.

create type public.block_kind as enum ('mute', 'block', 'not_interested');

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  kind public.block_kind not null,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  -- Se bloquer soi-même viderait son propre fil sans recours visible.
  constraint user_blocks_pas_soi_meme check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

-- Une liste de blocage est une confidence : son propriétaire seul la lit. La
-- personne bloquée ne doit surtout pas pouvoir la consulter — savoir qu'on est
-- bloqué est précisément ce qui déclenche le contournement.
create policy "lire ses propres blocages"
  on public.user_blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy "poser un blocage pour soi"
  on public.user_blocks for insert to authenticated
  with check (blocker_id = auth.uid());
create policy "changer la nature de son blocage"
  on public.user_blocks for update to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "retirer son blocage"
  on public.user_blocks for delete to authenticated
  using (blocker_id = auth.uid());

revoke all on public.user_blocks from anon, authenticated;
grant select, insert, update (kind), delete on public.user_blocks to authenticated;

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- Le fil respecte les trois gestes : `mute` et `block` retirent l'auteur,
-- `not_interested` le laisse mais l'amortit fortement. Retirer un auteur
-- seulement « moins intéressant » priverait l'utilisateur d'un retour possible.
drop view if exists public.videos_feed;
create view public.videos_feed as
with base as (
  select
    v.id, v.author_id, v.storage_path, v.thumb_path, v.caption, v.verse_ref,
    v.type, v.amen_count, v.pray_count, v.comment_count, v.duration_s,
    v.created_at, p.username, p.display_name,
    extract(epoch from (now() - v.created_at)) / 3600.0 as age_h,
    case
      when exists (
        select 1 from public.user_blocks b
        where b.blocker_id = auth.uid()
          and b.blocked_id = v.author_id
          and b.kind = 'not_interested'
      ) then 0.2
      else 1
    end as facteur_interet
  from public.videos v
  join public.profiles p on p.id = v.author_id
  where not v.hidden
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = auth.uid()
        and b.blocked_id = v.author_id
        and b.kind in ('mute', 'block')
    )
)
select
  id, author_id, storage_path, thumb_path, caption, verse_ref, type,
  amen_count, pray_count, comment_count, duration_s, created_at,
  username, display_name,
  round(
    (amen_count * 3 + pray_count * 5 + comment_count * 2 + 1)::numeric
      / power(age_h + 2, 1.35) * facteur_interet,
    6
  ) as score,
  row_number() over (
    partition by author_id
    order by (amen_count * 3 + pray_count * 5 + comment_count * 2 + 1)::numeric
      / power(age_h + 2, 1.35) * facteur_interet desc
  ) as rang_auteur
from base;

comment on view public.videos_feed is
  'Feed vidéo : colonnes minimales, lecture seule, authenticated. Exclut les auteurs mis en sourdine ou bloqués par le lecteur, amortit ceux marqués « moins intéressant ». Trier par (rang_auteur, score desc).';

alter view public.videos_feed set (security_invoker = true);
revoke all on public.videos_feed from anon, authenticated;
grant select on public.videos_feed to authenticated;

-- Un blocage doit empêcher l'abonnement, sinon il ne protège que l'affichage.
-- Le contrôle est en base : une garde applicative seule serait contournable par
-- un appel direct à PostgREST.
drop policy if exists "suivre" on public.follows;
drop policy if exists "suivre un auteur" on public.follows;
create policy "suivre un auteur qui ne m'a pas bloqué"
  on public.follows for insert to authenticated
  with check (
    follower_id = auth.uid()
    and follower_id <> followed_id
    and not exists (
      select 1 from public.user_blocks b
      where b.blocker_id = followed_id
        and b.blocked_id = auth.uid()
        and b.kind = 'block'
    )
  );

-- Taxonomie de signalement. Le motif était une chaîne libre — en pratique
-- toujours « signalement utilisateur », donc sans information exploitable pour
-- prioriser une file de modération.
create type public.report_category as enum (
  'spam',
  'harcelement',
  'haine',
  'violence',
  'contenu_sexuel',
  'desinformation',
  'usurpation',
  'hors_sujet',
  'autre'
);

-- Défaut `autre` : les lignes existantes restent valides et lisibles, aucune
-- réécriture d'historique de modération.
alter table public.reports
  add column if not exists category public.report_category not null default 'autre';

create index if not exists reports_category_idx on public.reports (category, status);

-- Le signalement reste borné à son auteur ; la catégorie s'ajoute au grant
-- d'écriture existant sans l'élargir à d'autres colonnes.
revoke insert on public.reports from authenticated;
grant insert (reporter_id, post_id, comment_id, video_id, reason, category)
  on public.reports to authenticated;
