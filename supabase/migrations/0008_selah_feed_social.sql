-- 0008 — Le feed devient social : commenter, suivre, prier une vidéo,
-- vignettes, et classement « édifiant » à la place du pur chronologique.

-- ── Compteurs et vignette sur la vidéo ────────────────────────────────────
alter table public.videos add column if not exists comment_count int not null default 0;
alter table public.videos add column if not exists pray_count int not null default 0;
alter table public.videos add column if not exists thumb_path text;

-- ── Commentaires de vidéo ─────────────────────────────────────────────────
create table if not exists public.video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.video_comments enable row level security;
create policy "commentaires vidéo lisibles" on public.video_comments
  for select to authenticated using (true);
create policy "commenter une vidéo" on public.video_comments
  for insert to authenticated with check (author_id = auth.uid());
create policy "supprimer son commentaire vidéo" on public.video_comments
  for delete to authenticated using (author_id = auth.uid());
create index if not exists video_comments_video_idx
  on public.video_comments (video_id, created_at desc);

create or replace function public.bump_video_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update videos set comment_count = comment_count + 1 where id = new.video_id; return new;
  else
    update videos set comment_count = greatest(comment_count - 1, 0) where id = old.video_id; return old;
  end if;
end $$;
drop trigger if exists video_comment_counter on public.video_comments;
create trigger video_comment_counter after insert or delete on public.video_comments
  for each row execute function public.bump_video_comment();

-- ── « Je prie pour toi » sur une vidéo ────────────────────────────────────
-- Distinct de l'Amen : l'Amen approuve, la prière intercède. Une seule fois
-- par personne et par vidéo (clé primaire), comme sur le mur de prière.
create table if not exists public.video_prayers (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  country char(2) not null default 'FR',
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
alter table public.video_prayers enable row level security;
create policy "prières vidéo lisibles" on public.video_prayers
  for select to authenticated using (true);
create policy "prier pour une vidéo" on public.video_prayers
  for insert to authenticated with check (user_id = auth.uid());

create or replace function public.bump_video_pray() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update videos set pray_count = pray_count + 1 where id = new.video_id; return new;
end $$;
drop trigger if exists video_pray_counter on public.video_prayers;
create trigger video_pray_counter after insert on public.video_prayers
  for each row execute function public.bump_video_pray();

-- ── Abonnements ───────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_pas_soi_meme check (follower_id <> followed_id)
);
alter table public.follows enable row level security;
create policy "abonnements lisibles" on public.follows
  for select to authenticated using (true);
create policy "suivre" on public.follows
  for insert to authenticated with check (follower_id = auth.uid());
create policy "ne plus suivre" on public.follows
  for delete to authenticated using (follower_id = auth.uid());
create index if not exists follows_followed_idx on public.follows (followed_id);

-- ── Signalement d'une vidéo ───────────────────────────────────────────────
alter table public.reports add column if not exists video_id uuid
  references public.videos(id) on delete cascade;

-- Les modérateurs doivent pouvoir clore un signalement, pas seulement le lire.
drop policy if exists "modérateurs traitent" on public.reports;
create policy "modérateurs traitent" on public.reports for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  );

-- Le bucket accueille aussi les vignettes JPEG générées à l'upload.
update storage.buckets
set allowed_mime_types = array['video/mp4','video/webm','video/quicktime','image/jpeg']
where id = 'videos';

-- ── Vue du feed v3 : classement édifiant + diversité d'auteurs ────────────
-- `author_id` est désormais exposé : il est de toute façon déductible de
-- `storage_path` (dossier = uuid de l'auteur), et le bouton « Suivre » en a
-- besoin. Aucune autre colonne de `profiles` n'est ajoutée.
--
-- Score : engagement pondéré (la prière pèse plus que l'amen — c'est
-- l'édification qu'on veut remonter, pas la popularité) amorti par l'âge,
-- décroissance douce type Hacker News.
-- `rang_auteur` sert la diversité : le client trie par (rang_auteur, score),
-- ce qui intercale les auteurs au lieu d'empiler les vidéos d'un seul.
-- La liste de colonnes change : `create or replace view` la refuse.
drop view if exists public.videos_feed;
create view public.videos_feed as
with base as (
  select
    v.id, v.author_id, v.storage_path, v.thumb_path, v.caption, v.verse_ref,
    v.type, v.amen_count, v.pray_count, v.comment_count, v.duration_s,
    v.created_at, p.username, p.display_name,
    extract(epoch from (now() - v.created_at)) / 3600.0 as age_h
  from public.videos v
  join public.profiles p on p.id = v.author_id
  where not v.hidden
)
select
  id, author_id, storage_path, thumb_path, caption, verse_ref, type,
  amen_count, pray_count, comment_count, duration_s, created_at,
  username, display_name,
  round(
    (amen_count * 3 + pray_count * 5 + comment_count * 2 + 1)::numeric
      / power(age_h + 2, 1.35),
    6
  ) as score,
  row_number() over (
    partition by author_id
    order by (amen_count * 3 + pray_count * 5 + comment_count * 2 + 1)::numeric
      / power(age_h + 2, 1.35) desc
  ) as rang_auteur
from base;

comment on view public.videos_feed is
  'Feed vidéo public : colonnes minimales, lecture seule, anon + authenticated. Trier par (rang_auteur, score desc).';

revoke all on public.videos_feed from anon, authenticated;
grant select on public.videos_feed to anon, authenticated;
