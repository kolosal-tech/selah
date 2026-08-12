\set ON_ERROR_STOP on

-- La fixture modération peut avoir supprimé 1 et 2; 3 sert d'adversaire non attesté.
reset role;
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000001', '{"username":"age-member"}'),
  ('00000000-0000-0000-0000-000000000002', '{"username":"age-mentor"}'),
  ('00000000-0000-0000-0000-000000000003', '{"username":"age-adversary"}')
on conflict (id) do nothing;
insert into public.profiles (id, username) values
  ('00000000-0000-0000-0000-000000000001', 'age-member'),
  ('00000000-0000-0000-0000-000000000002', 'age-mentor'),
  ('00000000-0000-0000-0000-000000000003', 'age-adversary')
on conflict (id) do nothing;
delete from public.age_attestations where user_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
delete from public.mentor_offers where user_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
delete from public.mentorships where mentor_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
) or mentee_id in (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);
-- Une offre historique reste en base mais n'apparaît plus dans l'annuaire.
insert into public.mentor_offers (user_id, topics)
values ('00000000-0000-0000-0000-000000000003', 'offre historique non attestée');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
do $$
begin
  begin
    insert into public.mentor_offers (user_id, topics) values (auth.uid(), 'refus non attesté');
    raise exception 'offre non attestée acceptée';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.mentorships (mentor_id, mentee_id) values (auth.uid(), '00000000-0000-0000-0000-000000000002');
    raise exception 'mentorat legacy non attesté accepté';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.age_attestations (user_id, policy_version)
    values ('00000000-0000-0000-0000-000000000002', '2026-08-11-v1');
    raise exception 'attestation adversaire acceptée';
  exception when insufficient_privilege then null;
  end;
end $$;

-- L'attestation est possible uniquement pour sa propre session et ne reçoit aucun paramètre.
select public.attest_age_18();
do $$ begin
  if not exists (select 1 from public.age_attestations where user_id = auth.uid() and policy_version = '2026-08-11-v1') then
    raise exception 'attestation personnelle absente';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);
select public.attest_age_18();
insert into public.mentor_offers (user_id, topics) values (auth.uid(), 'écoute');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
insert into public.mentorships (mentor_id, mentee_id)
values ('00000000-0000-0000-0000-000000000002', auth.uid());
do $$ begin
  if not exists (select 1 from public.mentorships where mentor_id = '00000000-0000-0000-0000-000000000002' and mentee_id = auth.uid()) then
    raise exception 'mentorat attesté absent';
  end if;
  if exists (select 1 from public.age_attestations where user_id = '00000000-0000-0000-0000-000000000002') then
    raise exception 'statut d''attestation tiers lisible';
  end if;
  if exists (select 1 from public.mentor_offers where user_id = '00000000-0000-0000-0000-000000000003') then
    raise exception 'offre non attestée visible';
  end if;
end $$;

-- Une cible non attestée ne peut jamais entrer dans une relation, même depuis une session attestée.
do $$
begin
  begin
    insert into public.mentorships (mentor_id, mentee_id)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');
    raise exception 'cible non attestée acceptée';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
