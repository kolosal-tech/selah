\set ON_ERROR_STOP on

-- À exécuter après tests/schema-reconstruction.sql et la migration audio.
-- Le vrai environnement Supabase expose auth.uid() à authenticated ; le
-- squelette PostgreSQL minimal de reconstruction ne crée pas ces grants.
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', '{"username":"audio-host"}'),
  ('00000000-0000-0000-0000-000000000002', '{"username":"audio-two"}'),
  ('00000000-0000-0000-0000-000000000003', '{"username":"audio-three"}'),
  ('00000000-0000-0000-0000-000000000004', '{"username":"audio-four"}'),
  ('00000000-0000-0000-0000-000000000005', '{"username":"audio-five"}');

insert into public.prayer_rooms (id, title, host_id)
values (
  '10000000-0000-0000-0000-000000000001',
  'Audio RLS',
  '00000000-0000-0000-0000-000000000001'
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);
insert into public.room_audio_participants (room_id, user_id)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);
insert into public.room_audio_participants (room_id, user_id)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002'
);
update public.room_audio_participants
set microphone_enabled = true
where room_id = '10000000-0000-0000-0000-000000000001'
  and user_id = '00000000-0000-0000-0000-000000000002';

do $$
declare
  denied boolean := false;
begin
  begin
    perform public.mute_all_room_audio(
      '10000000-0000-0000-0000-000000000001'
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'mute-all non autorisé accepté';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  false
);
insert into public.room_audio_participants (room_id, user_id)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000004',
  false
);
insert into public.room_audio_participants (room_id, user_id)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000004'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000005',
  false
);
do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.room_audio_participants (room_id, user_id)
    values (
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000005'
    );
  exception when others then
    blocked := true;
  end;
  if not blocked then
    raise exception 'cinquième participant accepté';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);
insert into public.room_audio_signals (
  room_id,
  sender_id,
  recipient_id,
  kind,
  payload
)
values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'offer',
  '{"type":"offer","sdp":"test"}'::jsonb
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  false
);
do $$
begin
  if exists (select 1 from public.room_audio_signals) then
    raise exception 'signal privé visible par un tiers';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);
do $$
begin
  if public.mute_all_room_audio(
    '10000000-0000-0000-0000-000000000001'
  ) <> 1 then
    raise exception 'mute-all hôte inattendu';
  end if;
end;
$$;

-- Le parcours de fermeture lui-même est antérieur à ce lot. On exécute ici
-- la mutation privilégiée pour isoler et vérifier le trigger audio de clôture.
reset role;
update public.prayer_rooms
set closed_at = now()
where id = '10000000-0000-0000-0000-000000000001';

do $$
begin
  if exists (
    select 1
    from public.room_audio_participants
    where room_id = '10000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'participants conservés après fermeture';
  end if;
end;
$$;

select 'AUDIO_RLS_OK' as verdict;
