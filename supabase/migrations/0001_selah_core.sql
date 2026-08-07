-- Selah — schéma coeur. Toute table exposée = RLS activé + policies explicites.

create type public.user_role as enum ('membre','leader','pasteur','moderateur','admin');
create type public.post_type as enum ('temoignage','exhortation','priere','enseignement','louange');
create type public.report_status as enum ('ouvert','traite','rejete');

-- Profils (lié à auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 30),
  display_name text not null default '',
  bio text not null default '',
  country char(2) not null default 'FR',
  lang text not null default 'fr',
  role public.user_role not null default 'membre',
  church_id uuid,
  charte_acceptee_le timestamptz not null default now(),
  sabbath_until timestamptz,            -- Mode Sabbat : app bloquée jusqu'à cette date
  streak_days int not null default 0,
  streak_last_day date,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles lisibles par connectés" on public.profiles
  for select to authenticated using (true);
create policy "chacun crée son profil" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "chacun modifie son profil" on public.profiles
  for update to authenticated using (id = auth.uid());

-- Églises vérifiées
create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default '',
  country char(2) not null default 'FR',
  verified boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.churches enable row level security;
create policy "annuaire lisible" on public.churches for select to authenticated using (true);
create policy "création par connectés" on public.churches for insert to authenticated
  with check (created_by = auth.uid());
alter table public.profiles add constraint profiles_church_fk
  foreign key (church_id) references public.churches(id) on delete set null;

-- Posts du fil
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  type public.post_type not null,
  body text not null check (char_length(body) between 1 and 4000),
  verse_ref text not null default '',   -- ex. "Jean 3:16"
  lang text not null default 'fr',
  amen_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
create policy "fil lisible" on public.posts for select to authenticated using (true);
create policy "poster" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "supprimer son post" on public.posts for delete to authenticated using (author_id = auth.uid());
create index posts_created_idx on public.posts (created_at desc);

create table public.amens (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.amens enable row level security;
create policy "amens lisibles" on public.amens for select to authenticated using (true);
create policy "dire amen" on public.amens for insert to authenticated with check (user_id = auth.uid());
create policy "retirer amen" on public.amens for delete to authenticated using (user_id = auth.uid());

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;
create policy "commentaires lisibles" on public.comments for select to authenticated using (true);
create policy "commenter" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "supprimer son commentaire" on public.comments for delete to authenticated using (author_id = auth.uid());
create index comments_post_idx on public.comments (post_id, created_at);

-- Prière
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  anonymous boolean not null default false,
  country char(2) not null default 'FR',
  pray_count int not null default 0,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.prayer_requests enable row level security;
create policy "requêtes lisibles" on public.prayer_requests for select to authenticated using (true);
create policy "demander la prière" on public.prayer_requests for insert to authenticated
  with check (author_id = auth.uid());
create policy "maj sa requête" on public.prayer_requests for update to authenticated
  using (author_id = auth.uid());
create index prayers_created_idx on public.prayer_requests (created_at desc);

create table public.prayer_actions (
  request_id uuid not null references public.prayer_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  country char(2) not null default 'FR',
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);
alter table public.prayer_actions enable row level security;
create policy "actions lisibles" on public.prayer_actions for select to authenticated using (true);
create policy "je prie" on public.prayer_actions for insert to authenticated with check (user_id = auth.uid());

-- Mentorat Paul & Timothée
create table public.mentorships (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  mentee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'propose' check (status in ('propose','actif','termine')),
  created_at timestamptz not null default now(),
  unique (mentor_id, mentee_id)
);
alter table public.mentorships enable row level security;
create policy "voir ses mentorats" on public.mentorships for select to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid());
create policy "proposer mentorat" on public.mentorships for insert to authenticated
  with check (mentor_id = auth.uid() or mentee_id = auth.uid());
create policy "maj mentorat" on public.mentorships for update to authenticated
  using (mentor_id = auth.uid() or mentee_id = auth.uid());

-- Disponibilité mentor (opt-in)
create table public.mentor_offers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  topics text not null default '',
  created_at timestamptz not null default now()
);
alter table public.mentor_offers enable row level security;
create policy "offres lisibles" on public.mentor_offers for select to authenticated using (true);
create policy "s'offrir mentor" on public.mentor_offers for insert to authenticated with check (user_id = auth.uid());
create policy "retirer offre" on public.mentor_offers for delete to authenticated using (user_id = auth.uid());

-- Modération
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null,
  status public.report_status not null default 'ouvert',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "signaler" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "modérateurs lisent" on public.reports for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur','admin')));

-- Compteurs dénormalisés via triggers (évite les count(*) sous charge)
create or replace function public.bump_amen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update posts set amen_count = amen_count + 1 where id = new.post_id; return new;
  else
    update posts set amen_count = greatest(amen_count - 1, 0) where id = old.post_id; return old;
  end if;
end $$;
create trigger amen_counter after insert or delete on public.amens
  for each row execute function public.bump_amen();

create or replace function public.bump_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update posts set comment_count = comment_count + 1 where id = new.post_id; return new;
end $$;
create trigger comment_counter after insert on public.comments
  for each row execute function public.bump_comment();

create or replace function public.bump_pray() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update prayer_requests set pray_count = pray_count + 1 where id = new.request_id; return new;
end $$;
create trigger pray_counter after insert on public.prayer_actions
  for each row execute function public.bump_pray();

-- Carte d'intercession : agrégat par pays sur 24h (vue, pas de PII)
create view public.intercession_map
with (security_invoker = true) as
  select country, count(*)::int as prayers_24h
  from public.prayer_actions
  where created_at > now() - interval '24 hours'
  group by country;

-- Streak spirituel : incrément quotidien à la première action du jour
create or replace function public.touch_streak(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare last_day date;
begin
  select streak_last_day into last_day from profiles where id = uid;
  if last_day = current_date then return;
  elsif last_day = current_date - 1 then
    update profiles set streak_days = streak_days + 1, streak_last_day = current_date where id = uid;
  else
    update profiles set streak_days = 1, streak_last_day = current_date where id = uid;
  end if;
end $$;
