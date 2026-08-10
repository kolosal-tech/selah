\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;

create schema auth;
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/')
$$;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create type public.user_role as enum ('membre','leader','pasteur','moderateur','admin');
create table public.profiles (
  id uuid primary key,
  username text not null,
  display_name text not null default '',
  bio text not null default '',
  country char(2) not null default 'FR',
  lang text not null default 'fr',
  role public.user_role not null default 'membre',
  church_id uuid,
  charte_acceptee_le timestamptz not null default now(),
  sabbath_until timestamptz,
  streak_days int not null default 0,
  streak_last_day date
);
create table public.prayer_requests (
  id uuid primary key,
  author_id uuid not null references public.profiles(id),
  body text not null,
  anonymous boolean not null default false,
  country char(2) not null default 'FR',
  pray_count int not null default 0,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.posts (
  id uuid primary key,
  author_id uuid not null references public.profiles(id),
  body text not null,
  comment_count int not null default 0
);
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id),
  author_id uuid not null references public.profiles(id),
  body text not null
);
create table public.videos (
  id uuid primary key,
  author_id uuid not null references public.profiles(id),
  storage_path text not null unique,
  thumb_path text,
  caption text not null default '',
  verse_ref text not null default '',
  type text not null default 'temoignage',
  duration_s int not null default 0,
  amen_count int not null default 0,
  view_count int not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.prayer_rooms (
  id uuid primary key,
  closed_at timestamptz
);
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.prayer_rooms(id),
  author_id uuid not null references public.profiles(id),
  body text not null
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  post_id uuid references public.posts(id),
  comment_id uuid references public.comments(id),
  video_id uuid references public.videos(id),
  reason text not null,
  status text not null default 'ouvert',
  created_at timestamptz not null default now()
);
create table public.mentor_offers (
  user_id uuid primary key references public.profiles(id),
  topics text not null default '',
  created_at timestamptz not null default now()
);
create table public.mentorships (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id),
  mentee_id uuid not null references public.profiles(id),
  status text not null default 'propose',
  created_at timestamptz not null default now(),
  unique (mentor_id, mentee_id)
);

alter table public.profiles enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.videos enable row level security;
alter table public.prayer_rooms enable row level security;
alter table public.room_messages enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.mentor_offers enable row level security;
alter table public.mentorships enable row level security;
alter table storage.objects enable row level security;

grant usage on schema public, storage, auth to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.prayer_requests to authenticated;
grant select, insert on public.videos to authenticated;
grant select on public.prayer_rooms to authenticated;
grant insert on public.room_messages to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on public.posts to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update, delete on public.mentor_offers to authenticated;
grant select, insert, update on public.mentorships to authenticated;

create policy "chacun crée son profil" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles lisibles par connectés" on public.profiles
  for select to authenticated using (true);
create policy "chacun modifie son profil" on public.profiles
  for update to authenticated using (id = auth.uid());
create policy "requêtes lisibles" on public.prayer_requests
  for select to authenticated using (true);
create policy "vidéos lisibles" on public.videos
  for select to authenticated using (true);
create policy "publier une vidéo" on public.videos
  for insert to authenticated with check (author_id = auth.uid());
create policy "salles lisibles" on public.prayer_rooms
  for select to authenticated using (true);
create policy "écrire dans la salle" on public.room_messages
  for insert to authenticated with check (author_id = auth.uid());
create policy "videos lecture publique" on storage.objects
  for select to authenticated using (bucket_id = 'videos');
create policy "videos depot dans son dossier" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos suppression de ses fichiers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "posts lisibles" on public.posts for select to authenticated using (true);
create policy "commenter" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "supprimer son commentaire" on public.comments for delete to authenticated using (author_id = auth.uid());
create policy "signaler" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "modérateurs lisent" on public.reports for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  );
create policy "modérateurs traitent" on public.reports for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  );
create policy "offres lisibles" on public.mentor_offers
  for select to authenticated using (true);
create policy "s'offrir mentor" on public.mentor_offers
  for insert to authenticated with check (user_id = auth.uid());
create policy "retirer offre" on public.mentor_offers
  for delete to authenticated using (user_id = auth.uid());
create policy "voir ses mentorats" on public.mentorships for select to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid());
create policy "proposer mentorat" on public.mentorships for insert to authenticated
  with check (mentor_id = auth.uid() or mentee_id = auth.uid());
create policy "maj mentorat" on public.mentorships for update to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid());

insert into public.profiles (id, username, role) values
  ('00000000-0000-0000-0000-000000000001', 'alice', 'membre'),
  ('00000000-0000-0000-0000-000000000002', 'bob', 'membre'),
  ('00000000-0000-0000-0000-000000000003', 'mod', 'moderateur');
insert into public.prayer_requests (id, author_id, body, anonymous) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 'Prière sensible', true);
insert into public.posts (id, author_id, body) values
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000002', 'Publication');
insert into public.videos (id, author_id, storage_path, thumb_path, hidden) values
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002/video.mp4', '00000000-0000-0000-0000-000000000002/video.jpg', true),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001/retry.mp4', null, false);
insert into public.prayer_rooms (id, closed_at) values
  ('00000000-0000-0000-0000-000000000031', now()),
  ('00000000-0000-0000-0000-000000000032', null);
insert into storage.buckets (id, name, public) values ('videos', 'videos', true);
insert into storage.objects (bucket_id, name) values
  ('videos', '00000000-0000-0000-0000-000000000002/video.mp4'),
  ('videos', '00000000-0000-0000-0000-000000000001/retry.mp4'),
  ('videos', '00000000-0000-0000-0000-000000000001/orphan.mp4');

\i /workspace/supabase/migrations/0009_security_baseline.sql
\i /workspace/supabase/migrations/0010_i18n_and_membership_integrity.sql
\i /workspace/supabase/migrations/0011_reports_and_counter_integrity.sql
\i /workspace/supabase/migrations/0012_rate_limits.sql
\i /workspace/supabase/migrations/0013_media_reconciliation.sql
\i /workspace/supabase/migrations/0014_moderation_audit.sql
\i /workspace/supabase/migrations/0015_safety_default_pause.sql
