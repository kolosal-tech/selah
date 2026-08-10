-- Réconcilie d'abord le schéma créé historiquement depuis le dashboard avec
-- celui reconstruit depuis les migrations versionnées.
alter table public.profiles
  add column if not exists locale text;
alter table public.profiles
  drop constraint if exists profiles_locale_check;
alter table public.profiles
  add constraint profiles_locale_check check (
    locale is null
    or locale in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko')
  );

alter table public.video_translations
  add column if not exists verse_text text;
alter table public.video_translations
  add column if not exists updated_at timestamptz not null default now();
alter table public.video_translations
  drop constraint if exists video_translations_lang_check;
alter table public.video_translations
  add constraint video_translations_lang_check check (
    lang in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko')
  );

drop policy if exists "traductions lecture publique" on public.video_translations;
create policy "traductions lecture publique"
  on public.video_translations for select to public using (true);

drop policy if exists "traductions ecriture par auteur" on public.video_translations;
create policy "traductions ecriture par auteur"
  on public.video_translations for insert to authenticated
  with check (exists (
    select 1 from public.videos v
    where v.id = video_id and v.author_id = auth.uid()
  ));

drop policy if exists "traductions maj par auteur" on public.video_translations;
create policy "traductions maj par auteur"
  on public.video_translations for update to authenticated
  using (exists (
    select 1 from public.videos v
    where v.id = video_id and v.author_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.videos v
    where v.id = video_id and v.author_id = auth.uid()
  ));

revoke all on public.video_translations from anon, authenticated;
grant select on public.video_translations to anon, authenticated;
grant insert, update, delete on public.video_translations to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := coalesce(
    nullif(new.raw_user_meta_data->>'username',''),
    'membre_' || substr(new.id::text, 1, 8)
  );
  affiche text := coalesce(
    nullif(new.raw_user_meta_data->>'display_name',''),
    wanted
  );
  ctry char(2) := upper(
    coalesce(nullif(new.raw_user_meta_data->>'country',''), 'FR')
  );
  loc text := nullif(new.raw_user_meta_data->>'locale','');
begin
  if loc is not null
     and loc not in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko') then
    loc := null;
  end if;
  begin
    insert into public.profiles (
      id, username, display_name, country, lang, locale
    ) values (
      new.id, wanted, affiche, ctry, coalesce(loc, 'fr'), loc
    );
  exception when unique_violation then
    insert into public.profiles (
      id, username, display_name, country, lang, locale
    ) values (
      new.id,
      wanted || '_' || substr(new.id::text, 1, 4),
      affiche,
      ctry,
      coalesce(loc, 'fr'),
      loc
    ) on conflict (id) do nothing;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- Même contrat que 0012, sans variable RETURNING inutilisée afin que le lint
-- PL/pgSQL de la base distante reste propre.
create or replace function public.consume_rate_limit(p_scope text)
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
  if actor is null then
    return false;
  end if;

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
    else
      raise exception 'rate limit scope non autorisé';
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

revoke execute on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

-- Audio rooms use direct WebRTC peer signalling only.  No TURN, SFU or external
-- signalling service is provisioned by this schema.
--
-- A participant row represents a currently connected member.  Deleting it
-- removes their ephemeral signalling records through the composite foreign keys.
create table public.room_audio_participants (
  room_id uuid not null references public.prayer_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  microphone_enabled boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_audio_participants_user_idx
  on public.room_audio_participants (user_id, room_id);

-- Serialise joins on the room row so four concurrent joins cannot exceed the
-- product limit of four active audio participants.
create or replace function public.enforce_room_audio_participant_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_count integer;
begin
  -- Trigger interne non appelable : le droit élevé sert seulement à purger
  -- les lignes abandonnées après une fermeture brutale du navigateur.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.room_id::text, 0)
  );

  delete from public.room_audio_participants
  where room_id = new.room_id
    and last_seen_at < pg_catalog.now() - interval '60 seconds';

  perform 1
  from public.prayer_rooms
  where id = new.room_id
    and closed_at is null;

  if not found then
    raise exception 'la salle est fermée ou introuvable';
  end if;

  select count(*) into participant_count
  from public.room_audio_participants
  where room_id = new.room_id
    and user_id <> new.user_id;

  if participant_count >= 4 then
    raise exception 'la salle audio est complète (maximum 4 participants)';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_room_audio_participant_limit() from public, anon, authenticated;

create trigger room_audio_participants_limit
before insert on public.room_audio_participants
for each row execute function public.enforce_room_audio_participant_limit();

-- Column grants are necessary for a SECURITY INVOKER RPC.  This trigger keeps
-- that grant from becoming a bypass: only the host or moderation can change a
-- microphone state, while members may still update their heartbeat.
create or replace function public.enforce_room_audio_mute_authorization()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.microphone_enabled is distinct from old.microphone_enabled
     and old.user_id <> auth.uid()
     and not exists (
       select 1
       from public.prayer_rooms r
       where r.id = old.room_id and r.host_id = auth.uid()
     )
     and not exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('moderateur', 'admin')
     ) then
    raise exception 'seul l’hôte ou la modération peut modifier le microphone';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_room_audio_mute_authorization() from public, anon, authenticated;

create trigger room_audio_participants_mute_authorization
before update of microphone_enabled on public.room_audio_participants
for each row execute function public.enforce_room_audio_mute_authorization();

-- Fermer la salle coupe immédiatement le maillage : la suppression des
-- participants cascade vers les signaux et déclenche un événement Realtime.
create or replace function public.disable_room_audio_when_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.closed_at is null and new.closed_at is not null then
    delete from public.room_audio_participants where room_id = new.id;
  end if;
  return new;
end;
$$;

revoke execute on function public.disable_room_audio_when_closed() from public, anon, authenticated;

create trigger prayer_rooms_disable_audio_when_closed
after update of closed_at on public.prayer_rooms
for each row execute function public.disable_room_audio_when_closed();

-- This helper avoids a self-referential RLS policy on the participant table.
-- It deliberately answers only whether the current caller belongs to a room.
create or replace function public.is_room_audio_participant(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.room_audio_participants
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_audio_participant(uuid) from public, anon;
grant execute on function public.is_room_audio_participant(uuid) to authenticated;

-- Messages are deliberately addressed to one peer.  Their payload is the
-- opaque SDP/ICE data exchanged by the clients and is bounded to prevent the
-- signalling channel from becoming a general-purpose message store.
create table public.room_audio_signals (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.prayer_rooms(id) on delete cascade,
  sender_id uuid not null,
  recipient_id uuid not null,
  kind text not null check (kind in ('offer', 'answer', 'ice')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object')
    check (octet_length(payload::text) <= 65536),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  foreign key (room_id, sender_id)
    references public.room_audio_participants (room_id, user_id) on delete cascade,
  foreign key (room_id, recipient_id)
    references public.room_audio_participants (room_id, user_id) on delete cascade
);

create index room_audio_signals_recipient_idx
  on public.room_audio_signals (room_id, recipient_id, created_at);

-- A table-level guard complements RLS: a closed room cannot receive a signal
-- even from a privileged internal client that bypasses row-level policies.
create or replace function public.enforce_open_room_audio_signal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform 1
  from public.prayer_rooms
  where id = new.room_id and closed_at is null;

  if not found then
    raise exception 'la salle est fermée ou introuvable';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_open_room_audio_signal() from public, anon, authenticated;

create trigger room_audio_signals_open_room
before insert on public.room_audio_signals
for each row execute function public.enforce_open_room_audio_signal();

alter table public.room_audio_participants enable row level security;
alter table public.room_audio_signals enable row level security;

revoke all on public.room_audio_participants from anon, authenticated;
revoke all on public.room_audio_signals from anon, authenticated;

-- Les policies et la RPC consultent ces relations via l'appelant. Ces grants
-- explicite est requis sur les projets qui n'exposent plus les nouvelles
-- tables automatiquement ; leurs propres RLS restent appliquées. `videos`
-- est aussi consultée par la policy Storage historique de lecture autorisée.
grant select on public.prayer_rooms, public.profiles, public.videos to authenticated;
grant select, insert, delete on public.room_audio_participants to authenticated;
grant update (microphone_enabled, last_seen_at) on public.room_audio_participants to authenticated;
grant select, insert, delete on public.room_audio_signals to authenticated;
grant usage, select on sequence public.room_audio_signals_id_seq to authenticated;

create policy "participants audio lisibles par participants" on public.room_audio_participants
  for select to authenticated
  using (public.is_room_audio_participant(room_id));

create policy "rejoindre une salle audio ouverte" on public.room_audio_participants
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.closed_at is null
    )
  );

create policy "quitter sa salle audio" on public.room_audio_participants
  for delete to authenticated
  using (user_id = auth.uid());

-- Only the host, an administrator, or a moderator may change server-side mute
-- state.  The same policy permits the SECURITY INVOKER RPC below to update.
create policy "hôte et modération gèrent les micros audio" on public.room_audio_participants
  for update to authenticated
  using (
    exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.host_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  );

-- A participant can update its presence heartbeat.  The trigger above keeps
-- the column-level microphone grant reserved to room moderation.
create policy "participant met à jour sa présence audio" on public.room_audio_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A peer may read only the signals it sent or received, and only while it is
-- still a participant.  Other room participants cannot inspect SDP/ICE data.
create policy "signaux audio privés aux deux pairs" on public.room_audio_signals
  for select to authenticated
  using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and public.is_room_audio_participant(room_id)
  );

create policy "envoyer un signal audio dans salle ouverte" on public.room_audio_signals
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.closed_at is null
    )
    and exists (
      select 1 from public.room_audio_participants sender
      where sender.room_id = room_id and sender.user_id = sender_id
    )
    and exists (
      select 1 from public.room_audio_participants recipient
      where recipient.room_id = room_id and recipient.user_id = recipient_id
    )
  );

create policy "destinataire consomme le signal audio" on public.room_audio_signals
  for delete to authenticated
  using (
    recipient_id = auth.uid()
    and public.is_room_audio_participant(room_id)
  );

-- SECURITY INVOKER is intentional: the caller's grants and RLS policies still
-- apply, while the function centralises the all-participants update.
create or replace function public.mute_all_room_audio(p_room_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    raise exception 'authentification requise';
  end if;

  if not exists (
    select 1
    from public.prayer_rooms r
    where r.id = p_room_id
      and (
        r.host_id = auth.uid()
        or exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('moderateur', 'admin')
        )
      )
  ) then
    raise insufficient_privilege
      using message = 'action réservée à l’hôte, un modérateur ou un administrateur';
  end if;

  update public.room_audio_participants
  set microphone_enabled = false
  where room_id = p_room_id
    and microphone_enabled is true;

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

revoke all on function public.mute_all_room_audio(uuid) from public, anon;
grant execute on function public.mute_all_room_audio(uuid) to authenticated;

-- Realtime diffuse l'état éphémère et les signaux adressés, jamais le flux
-- audio. Les contrôles catalogue rendent les ajouts idempotents.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_audio_participants'
  ) then
    alter publication supabase_realtime add table public.room_audio_participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_audio_signals'
  ) then
    alter publication supabase_realtime add table public.room_audio_signals;
  end if;
end;
$$;

-- L'upload vidéo/audio conserve `upsert: true` pour qu'une reprise réseau
-- réécrive exactement le même objet. Storage exige alors SELECT en plus de
-- INSERT/UPDATE : l'auteur peut lire ses propres dépôts, y compris avant la
-- création de la ligne public.videos, sans rendre ceux des autres visibles.
drop policy if exists "videos lecture de ses dépôts" on storage.objects;
create policy "videos lecture de ses dépôts" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

update storage.buckets
set allowed_mime_types = array[
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/jpeg',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
  'audio/wav'
]
where id = 'videos';

-- Les actions serveur bornent déjà le chemin au compte courant. La contrainte
-- rend cette propriété vraie même pour une future écriture SQL/PostgREST.
-- NOT VALID évite de bloquer l'application de la migration si une ancienne
-- ligne manuelle doit d'abord être réconciliée ; toute nouvelle valeur ou
-- modification est néanmoins contrôlée immédiatement.
alter table public.profiles
  drop constraint if exists profiles_avatar_path_owned;
alter table public.profiles
  add constraint profiles_avatar_path_owned check (
    avatar_path is null
    or avatar_path ~ (
      '^' || id::text || '/avatar-[0-9A-Fa-f-]{36}[.](jpg|jpeg|png|webp)$'
    )
  ) not valid;
