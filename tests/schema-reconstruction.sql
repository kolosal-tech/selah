\set ON_ERROR_STOP on

-- Interfaces minimales fournies par Supabase et utilisées par les migrations.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create table auth.users (
  id uuid primary key,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
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
alter table storage.objects enable row level security;

create publication supabase_realtime;

\i /workspace/supabase/migrations/0001_selah_core.sql
\i /workspace/supabase/migrations/0002_selah_lockdown_functions.sql
\i /workspace/supabase/migrations/0003_selah_handle_new_user.sql
\i /workspace/supabase/migrations/0004_selah_phase2.sql
\i /workspace/supabase/migrations/0005_selah_bucket_videos.sql
\i /workspace/supabase/migrations/0006_selah_feed_public.sql
\i /workspace/supabase/migrations/0007_selah_moderation_videos.sql
\i /workspace/supabase/migrations/0008_selah_feed_social.sql
\i /workspace/supabase/migrations/0009_security_baseline.sql
\i /workspace/supabase/migrations/0010_i18n_and_membership_integrity.sql
\i /workspace/supabase/migrations/0011_reports_and_counter_integrity.sql
\i /workspace/supabase/migrations/0012_rate_limits.sql
\i /workspace/supabase/migrations/0013_media_reconciliation.sql
\i /workspace/supabase/migrations/0014_moderation_audit.sql
\i /workspace/supabase/migrations/0015_safety_default_pause.sql
\i /workspace/supabase/migrations/0016_reenable_video_mentorship.sql
\i /workspace/supabase/migrations/0017_profile_avatars.sql
\i /workspace/supabase/migrations/0018_profile_avatar_delete.sql
\i /workspace/supabase/migrations/20260807093647_selah_core.sql
\i /workspace/supabase/migrations/20260807093710_selah_lockdown_functions.sql
\i /workspace/supabase/migrations/20260807093750_selah_handle_new_user.sql
\i /workspace/supabase/migrations/20260807155724_selah_phase2.sql
\i /workspace/supabase/migrations/20260807155742_selah_bucket_videos.sql
\i /workspace/supabase/migrations/20260807182936_selah_feed_public.sql
\i /workspace/supabase/migrations/20260807184502_selah_moderation_videos.sql
\i /workspace/supabase/migrations/20260807190502_selah_feed_social.sql
\i /workspace/supabase/migrations/20260808152041_i18n_locale_et_traductions_videos.sql
\i /workspace/supabase/migrations/20260808191926_inscription_prenom_ou_pseudo.sql
\i /workspace/supabase/migrations/20260810221136_media_profile_room_audio.sql
\i /workspace/supabase/migrations/20260810231500_security_performance_advisors.sql
\i /workspace/supabase/migrations/20260811120000_product_analytics.sql
\i /workspace/supabase/migrations/20260811150000_anonymous_events_and_vitals.sql
\i /workspace/supabase/migrations/20260811160000_anonymous_rpc_invoker.sql
\i /workspace/supabase/migrations/20260811170000_blocages_et_taxonomie.sql
\i /workspace/supabase/migrations/20260811200000_moderation_cases_appeals.sql
\i /workspace/supabase/migrations/20260811210000_account_lifecycle.sql
\i /workspace/supabase/migrations/20260811220000_age_attestation_mentorat.sql
\i /workspace/supabase/migrations/20260811230000_moderation_public_rpc_grants.sql

do $$
begin
  if to_regclass('public.video_translations') is null then
    raise exception 'video_translations absente après reconstruction';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'video_translations'
      and column_name = 'verse_text'
  ) then
    raise exception 'verse_text absent après réconciliation';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'locale'
  ) then
    raise exception 'locale profil absente après réconciliation';
  end if;
  if to_regclass('public.rate_limit_windows') is null then
    raise exception 'rate_limit_windows absente après reconstruction';
  end if;
  if to_regclass('public.moderation_events') is null then
    raise exception 'moderation_events absente après reconstruction';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'room_messages'
      and policyname = 'écrire dans une salle ouverte et limitée'
  ) then
    raise exception 'policy rate limit des messages absente';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'videos'
      and policyname = 'publier une vidéo'
  ) then
    raise exception 'publication vidéo absente après réactivation contrôlée';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_path'
  ) then
    raise exception 'avatar_path absent après reconstruction';
  end if;
  if to_regclass('public.room_audio_participants') is null
     or to_regclass('public.room_audio_signals') is null then
    raise exception 'tables audio absentes après reconstruction';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'videos lecture de ses dépôts'
  ) then
    raise exception 'policy propriétaire Storage absente';
  end if;
  if not exists (
    select 1 from storage.buckets
    where id = 'videos'
      and allowed_mime_types @> array[
        'audio/mpeg', 'audio/mp4', 'audio/x-m4a',
        'audio/webm', 'audio/ogg', 'audio/wav'
      ]::text[]
  ) then
    raise exception 'types audio absents du bucket videos';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_avatar_path_owned'
  ) then
    raise exception 'contrainte propriétaire avatar absente';
  end if;
  if not exists (
    select 1 from pg_class
    where oid = 'public.videos_feed'::regclass
      and reloptions @> array['security_invoker=true']
  ) then
    raise exception 'videos_feed reste SECURITY DEFINER';
  end if;
  if has_function_privilege('anon', 'public.bump_video_comment()', 'execute')
     or has_function_privilege('authenticated', 'public.bump_video_comment()', 'execute') then
    raise exception 'trigger compteur vidéo encore appelable en RPC';
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'consume_rate_limit'
      and not p.prosecdef
  ) then
    raise exception 'wrapper rate limit public reste SECURITY DEFINER';
  end if;
  if to_regclass('public.videos_author_id_idx') is null
     or to_regclass('public.room_audio_signals_sender_idx') is null then
    raise exception 'index de clés étrangères absent';
  end if;
end $$;
