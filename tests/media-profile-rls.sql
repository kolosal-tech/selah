\set ON_ERROR_STOP on

-- `room-audio-rls.sql`, chargé juste avant, a créé les cinq comptes de test et
-- les grants auth du squelette Supabase. Alice doit pouvoir reprendre son
-- propre objet non encore publié ; Bob ne doit ni le lire ni le modifier.
grant usage on schema storage to authenticated;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

insert into storage.objects (bucket_id, name)
values (
  'videos',
  '00000000-0000-0000-0000-000000000001/reprise-audio.weba'
);

do $$
declare
  visible_count integer;
  updated_count integer;
begin
  select count(*) into visible_count
  from storage.objects
  where name = '00000000-0000-0000-0000-000000000001/reprise-audio.weba';
  if visible_count <> 1 then
    raise exception 'dépôt propriétaire non lisible pour upsert';
  end if;

  update storage.objects
  set metadata = '{"cacheControl":"3600"}'::jsonb
  where name = '00000000-0000-0000-0000-000000000001/reprise-audio.weba';
  get diagnostics updated_count = row_count;
  if updated_count <> 1 then
    raise exception 'reprise upsert propriétaire refusée';
  end if;
end;
$$;

update public.profiles
set avatar_path =
  '00000000-0000-0000-0000-000000000001/avatar-11111111-1111-1111-1111-111111111111.jpg'
where id = auth.uid();

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

do $$
declare
  visible_count integer;
  updated_count integer;
  avatar_blocked boolean := false;
begin
  select count(*) into visible_count
  from storage.objects
  where name = '00000000-0000-0000-0000-000000000001/reprise-audio.weba';
  if visible_count <> 0 then
    raise exception 'dépôt privé visible par un autre membre';
  end if;

  update storage.objects
  set metadata = '{}'::jsonb
  where name = '00000000-0000-0000-0000-000000000001/reprise-audio.weba';
  get diagnostics updated_count = row_count;
  if updated_count <> 0 then
    raise exception 'dépôt privé modifié par un autre membre';
  end if;

  begin
    update public.profiles
    set avatar_path =
      '00000000-0000-0000-0000-000000000001/avatar-22222222-2222-2222-2222-222222222222.jpg'
    where id = auth.uid();
  exception when check_violation then
    avatar_blocked := true;
  end;
  if not avatar_blocked then
    raise exception 'chemin avatar étranger accepté';
  end if;
end;
$$;

reset role;

insert into auth.users (id, raw_user_meta_data)
values (
  '00000000-0000-0000-0000-000000000009',
  '{"username":"aicha","display_name":"Aïcha","country":"BF","locale":"en"}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '00000000-0000-0000-0000-000000000009'
      and username = 'aicha'
      and display_name = 'Aïcha'
      and country = 'BF'
      and lang = 'en'
      and locale = 'en'
  ) then
    raise exception 'profil multilingue mal créé par handle_new_user';
  end if;
end;
$$;

insert into public.videos (
  id, author_id, storage_path, caption, verse_ref, type, duration_s
) values (
  '00000000-0000-0000-0000-000000000081',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001/traduction.mp4',
  'Témoignage', '', 'temoignage', 10
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);
insert into public.video_translations (
  video_id, lang, caption, verse_text
) values (
  '00000000-0000-0000-0000-000000000081',
  'en', 'Testimony', 'Verse'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);
do $$
declare
  foreign_insert_blocked boolean := false;
begin
  begin
    insert into public.video_translations (video_id, lang, caption)
    values (
      '00000000-0000-0000-0000-000000000081',
      'es', 'Testimonio'
    );
  exception when insufficient_privilege then
    foreign_insert_blocked := true;
  end;
  if not foreign_insert_blocked then
    raise exception 'traduction étrangère acceptée';
  end if;
end;
$$;

reset role;
set role anon;
do $$
begin
  if (select count(*) from public.video_translations
      where video_id = '00000000-0000-0000-0000-000000000081') <> 1 then
    raise exception 'traduction publique non lisible';
  end if;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'videos'
      and allowed_mime_types @> array[
        'audio/mpeg', 'audio/mp4', 'audio/x-m4a',
        'audio/webm', 'audio/ogg', 'audio/wav'
      ]::text[]
  ) then
    raise exception 'MIME audio Storage incomplets';
  end if;
end;
$$;

select 'MEDIA_PROFILE_RLS_OK' as verdict;
