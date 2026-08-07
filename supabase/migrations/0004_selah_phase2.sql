-- Phase 2 : vidéos verticales, Upper Room (salles de prière temps réel),
-- défis communautaires, dashboard pasteur.
-- (Contenu identique à la migration appliquée en production : selah_phase2.)

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 500),
  verse_ref text not null default '',
  type public.post_type not null default 'temoignage',
  duration_s int not null default 0 check (duration_s between 0 and 300),
  amen_count int not null default 0,
  view_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.videos enable row level security;
create policy "vidéos lisibles" on public.videos for select to authenticated using (true);
create policy "publier une vidéo" on public.videos for insert to authenticated
  with check (author_id = auth.uid());
create policy "supprimer sa vidéo" on public.videos for delete to authenticated
  using (author_id = auth.uid());
create index videos_created_idx on public.videos (created_at desc);

create table public.video_amens (
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, user_id)
);
alter table public.video_amens enable row level security;
create policy "amens vidéo lisibles" on public.video_amens for select to authenticated using (true);
create policy "amen vidéo" on public.video_amens for insert to authenticated with check (user_id = auth.uid());
create policy "retirer amen vidéo" on public.video_amens for delete to authenticated using (user_id = auth.uid());

create or replace function public.bump_video_amen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update videos set amen_count = amen_count + 1 where id = new.video_id; return new;
  else
    update videos set amen_count = greatest(amen_count - 1, 0) where id = old.video_id; return old;
  end if;
end $$;
revoke execute on function public.bump_video_amen() from public, anon, authenticated;
create trigger video_amen_counter after insert or delete on public.video_amens
  for each row execute function public.bump_video_amen();

create table public.prayer_rooms (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  topic text not null default '',
  host_id uuid not null references public.profiles(id) on delete cascade,
  lang text not null default 'fr',
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.prayer_rooms enable row level security;
create policy "salles lisibles" on public.prayer_rooms for select to authenticated using (true);
create policy "ouvrir une salle" on public.prayer_rooms for insert to authenticated
  with check (host_id = auth.uid());
create policy "fermer sa salle" on public.prayer_rooms for update to authenticated
  using (host_id = auth.uid());

create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.prayer_rooms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table public.room_messages enable row level security;
create policy "messages lisibles" on public.room_messages for select to authenticated using (true);
create policy "écrire dans la salle" on public.room_messages for insert to authenticated
  with check (author_id = auth.uid());
create index room_messages_idx on public.room_messages (room_id, created_at);

alter publication supabase_realtime add table public.room_messages;

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  days int not null check (days between 1 and 365),
  starts_on date not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.challenges enable row level security;
create policy "défis lisibles" on public.challenges for select to authenticated using (true);
create policy "créer un défi" on public.challenges for insert to authenticated
  with check (created_by = auth.uid());

create table public.challenge_checkins (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default current_date,
  primary key (challenge_id, user_id, day)
);
alter table public.challenge_checkins enable row level security;
create policy "pointages lisibles" on public.challenge_checkins for select to authenticated using (true);
create policy "pointer" on public.challenge_checkins for insert to authenticated
  with check (user_id = auth.uid());

create view public.church_pulse
with (security_invoker = true) as
select
  p.church_id,
  count(distinct p.id)::int                                as membres,
  coalesce(sum(p.streak_days), 0)::int                     as jours_de_fidelite,
  (select count(*) from public.posts o where o.author_id in
     (select id from public.profiles q where q.church_id = p.church_id)
     and o.created_at > now() - interval '7 days')::int    as posts_7j,
  (select count(*) from public.prayer_actions a where a.user_id in
     (select id from public.profiles q where q.church_id = p.church_id)
     and a.created_at > now() - interval '7 days')::int    as prieres_7j
from public.profiles p
where p.church_id is not null
group by p.church_id;
