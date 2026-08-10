-- Durcissement guidé par les advisors Supabase après la migration audio.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Les fonctions élevées vivent hors du schéma exposé. Les wrappers publics
-- restent SECURITY INVOKER et ne transmettent aucun identifiant arbitraire.
create or replace function private.consume_rate_limit_impl(p_scope text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  max_requests integer;
  window_seconds integer;
  bucket timestamptz;
begin
  if actor is null then return false; end if;
  case p_scope
    when 'post' then max_requests := 6; window_seconds := 60;
    when 'comment' then max_requests := 12; window_seconds := 60;
    when 'prayer_request' then max_requests := 6; window_seconds := 60;
    when 'prayer_action' then max_requests := 20; window_seconds := 60;
    when 'report' then max_requests := 6; window_seconds := 600;
    when 'translation' then max_requests := 12; window_seconds := 60;
    when 'video_publish' then max_requests := 6; window_seconds := 3600;
    when 'video_amen' then max_requests := 30; window_seconds := 60;
    when 'video_comment' then max_requests := 12; window_seconds := 60;
    when 'video_prayer' then max_requests := 20; window_seconds := 60;
    when 'follow' then max_requests := 20; window_seconds := 60;
    when 'room_create' then max_requests := 3; window_seconds := 3600;
    when 'room_message' then max_requests := 12; window_seconds := 60;
    when 'challenge_create' then max_requests := 3; window_seconds := 86400;
    else raise exception 'rate limit scope non autorisé';
  end case;

  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );
  insert into public.rate_limit_windows (actor_id, scope, window_started, count)
  values (actor, p_scope, bucket, 1)
  on conflict (actor_id, scope) do update
    set window_started = excluded.window_started,
        count = case
          when public.rate_limit_windows.window_started < excluded.window_started then 1
          else public.rate_limit_windows.count + 1
        end
    where public.rate_limit_windows.window_started < excluded.window_started
       or public.rate_limit_windows.count < max_requests;
  return found;
end;
$$;

revoke all on function private.consume_rate_limit_impl(text) from public, anon;
grant execute on function private.consume_rate_limit_impl(text) to authenticated;

create or replace function public.consume_rate_limit(p_scope text)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.consume_rate_limit_impl(p_scope) $$;
revoke all on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

create or replace function private.is_room_audio_participant_impl(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.room_audio_participants
    where room_id = p_room_id and user_id = auth.uid()
  )
$$;
revoke all on function private.is_room_audio_participant_impl(uuid) from public, anon;
grant execute on function private.is_room_audio_participant_impl(uuid) to authenticated;

create or replace function public.is_room_audio_participant(p_room_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_room_audio_participant_impl(p_room_id) $$;
revoke all on function public.is_room_audio_participant(uuid) from public, anon;
grant execute on function public.is_room_audio_participant(uuid) to authenticated;

create or replace function private.touch_streak_impl()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  last_day date;
begin
  if uid is null then return; end if;
  select streak_last_day into last_day from public.profiles where id = uid;
  if last_day = current_date then return;
  elsif last_day = current_date - 1 then
    update public.profiles
    set streak_days = streak_days + 1, streak_last_day = current_date
    where id = uid;
  else
    update public.profiles
    set streak_days = 1, streak_last_day = current_date
    where id = uid;
  end if;
end;
$$;
revoke all on function private.touch_streak_impl() from public, anon;
grant execute on function private.touch_streak_impl() to authenticated;

create or replace function public.touch_streak()
returns void
language sql
security invoker
set search_path = ''
as $$ select private.touch_streak_impl() $$;
revoke all on function public.touch_streak() from public, anon;
grant execute on function public.touch_streak() to authenticated;

-- Les fonctions de trigger ne sont jamais des RPC.
revoke all on function public.bump_video_comment() from public, anon, authenticated;
revoke all on function public.bump_video_pray() from public, anon, authenticated;

-- Vue du feed : la page est désormais authentifiée et les tables sous-jacentes
-- ont leurs propres RLS, donc aucun droit propriétaire n'est nécessaire.
alter view public.videos_feed set (security_invoker = true);
revoke all on public.videos_feed from anon;
grant select on public.videos_feed to authenticated;
comment on view public.videos_feed is
  'Feed vidéo authentifié, lecture seule, SECURITY INVOKER.';

-- Les trois autres vues doivent masquer des colonnes ou inventorier Storage.
-- Une fonction privée vérifie l'appelant et la vue publique reste INVOKER.
create or replace function private.prayer_requests_public_rows()
returns table (
  id uuid,
  body text,
  anonymous boolean,
  country character(2),
  pray_count integer,
  answered boolean,
  created_at timestamptz,
  username text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.body, r.anonymous, r.country, r.pray_count, r.answered,
    r.created_at, case when r.anonymous then null else p.username end
  from public.prayer_requests r
  join public.profiles p on p.id = r.author_id
  where auth.uid() is not null
$$;
revoke all on function private.prayer_requests_public_rows() from public, anon;
grant execute on function private.prayer_requests_public_rows() to authenticated;

drop view if exists public.prayer_requests_public;
create view public.prayer_requests_public
with (security_barrier = true, security_invoker = true) as
select * from private.prayer_requests_public_rows();
revoke all on public.prayer_requests_public from anon;
grant select on public.prayer_requests_public to authenticated;

create or replace function private.video_storage_orphans_rows()
returns table (object_id uuid, storage_path text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.name, o.created_at
  from storage.objects o
  where o.bucket_id = 'videos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
    and not exists (
      select 1 from public.videos v
      where v.storage_path = o.name or v.thumb_path = o.name
    )
    and not exists (
      select 1 from public.video_translations t
      where t.storage_path = o.name or t.thumb_path = o.name
    )
$$;
revoke all on function private.video_storage_orphans_rows() from public, anon;
grant execute on function private.video_storage_orphans_rows() to authenticated;

drop view if exists public.video_storage_orphans;
create view public.video_storage_orphans
with (security_barrier = true, security_invoker = true) as
select * from private.video_storage_orphans_rows();
revoke all on public.video_storage_orphans from anon;
grant select on public.video_storage_orphans to authenticated;

create or replace function private.video_storage_missing_rows()
returns table (source text, video_id uuid, expected_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'video'::text, v.id, v.storage_path
  from public.videos v
  where exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderateur', 'admin')
  )
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'videos' and o.name = v.storage_path
  )
  union all
  select 'thumbnail'::text, v.id, v.thumb_path
  from public.videos v
  where v.thumb_path is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'videos' and o.name = v.thumb_path
    )
  union all
  select 'translation'::text, t.video_id, t.storage_path
  from public.video_translations t
  where t.storage_path is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'videos' and o.name = t.storage_path
    )
  union all
  select 'translation_thumbnail'::text, t.video_id, t.thumb_path
  from public.video_translations t
  where t.thumb_path is not null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'videos' and o.name = t.thumb_path
    )
$$;
revoke all on function private.video_storage_missing_rows() from public, anon;
grant execute on function private.video_storage_missing_rows() to authenticated;

drop view if exists public.video_storage_missing;
create view public.video_storage_missing
with (security_barrier = true, security_invoker = true) as
select * from private.video_storage_missing_rows();
revoke all on public.video_storage_missing from anon;
grant select on public.video_storage_missing to authenticated;

-- RLS fermé explicite pour la table interne du rate limiter.
drop policy if exists "accès direct interdit" on public.rate_limit_windows;
create policy "accès direct interdit" on public.rate_limit_windows
  for all to anon, authenticated using (false) with check (false);

-- Évalue auth.uid() une fois par requête plutôt qu'une fois par ligne pour
-- toutes les policies historiques. Les expressions viennent du catalogue et
-- les identifiants sont quotés par format(%I).
do $$
declare
  p record;
  sql text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') like '%auth.uid()%'
        or coalesce(with_check, '') like '%auth.uid()%'
      )
  loop
    sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if p.qual is not null then
      sql := sql || ' using (' || replace(p.qual, 'auth.uid()', '(select auth.uid())') || ')';
    end if;
    if p.with_check is not null then
      sql := sql || ' with check (' || replace(p.with_check, 'auth.uid()', '(select auth.uid())') || ')';
    end if;
    execute sql;
  end loop;
end;
$$;

-- Une seule policy par action sur les traductions.
drop policy if exists "traductions vidéo lisibles" on public.video_translations;
drop policy if exists "modérateurs gèrent traductions vidéo" on public.video_translations;
drop policy if exists "traductions lecture publique" on public.video_translations;
drop policy if exists "traductions ecriture par auteur" on public.video_translations;
drop policy if exists "traductions maj par auteur" on public.video_translations;

create policy "traductions lecture publique" on public.video_translations
  for select to public using (true);
create policy "traductions création autorisée" on public.video_translations
  for insert to authenticated with check (
    exists (
      select 1 from public.videos v
      where v.id = video_id and v.author_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('moderateur', 'admin')
    )
  );
create policy "traductions mise à jour autorisée" on public.video_translations
  for update to authenticated
  using (
    exists (
      select 1 from public.videos v
      where v.id = video_id and v.author_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('moderateur', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.videos v
      where v.id = video_id and v.author_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('moderateur', 'admin')
    )
  );
create policy "traductions suppression modération" on public.video_translations
  for delete to authenticated using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('moderateur', 'admin')
    )
  );

-- Une seule policy UPDATE audio ; le trigger conserve le contrôle par colonne.
drop policy if exists "hôte et modération gèrent les micros audio" on public.room_audio_participants;
drop policy if exists "participant met à jour sa présence audio" on public.room_audio_participants;
create policy "mise à jour audio autorisée" on public.room_audio_participants
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.host_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('moderateur', 'admin')
    )
  )
  with check (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.host_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role in ('moderateur', 'admin')
    )
  );

-- Index couvrant chaque clé étrangère signalée par l'advisor.
create index if not exists amens_user_id_idx on public.amens (user_id);
create index if not exists challenge_checkins_user_id_idx on public.challenge_checkins (user_id);
create index if not exists challenges_created_by_idx on public.challenges (created_by);
create index if not exists churches_created_by_idx on public.churches (created_by);
create index if not exists comments_author_id_idx on public.comments (author_id);
create index if not exists mentorships_mentee_id_idx on public.mentorships (mentee_id);
create index if not exists moderation_events_actor_id_idx on public.moderation_events (actor_id);
create index if not exists moderation_events_report_id_idx on public.moderation_events (report_id);
create index if not exists moderation_events_video_id_idx on public.moderation_events (video_id);
create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists prayer_actions_user_id_idx on public.prayer_actions (user_id);
create index if not exists prayer_requests_author_id_idx on public.prayer_requests (author_id);
create index if not exists prayer_rooms_host_id_idx on public.prayer_rooms (host_id);
create index if not exists profiles_church_id_idx on public.profiles (church_id);
create index if not exists reports_comment_id_idx on public.reports (comment_id);
create index if not exists reports_post_id_idx on public.reports (post_id);
create index if not exists reports_video_id_idx on public.reports (video_id);
create index if not exists room_audio_signals_sender_idx on public.room_audio_signals (room_id, sender_id);
create index if not exists room_messages_author_id_idx on public.room_messages (author_id);
create index if not exists video_amens_user_id_idx on public.video_amens (user_id);
create index if not exists video_comments_author_id_idx on public.video_comments (author_id);
create index if not exists video_prayers_user_id_idx on public.video_prayers (user_id);
create index if not exists videos_author_id_idx on public.videos (author_id);
