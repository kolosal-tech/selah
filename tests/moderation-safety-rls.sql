\set ON_ERROR_STOP on

do $$ begin
  if has_function_privilege('anon', 'public.triage_moderation_case(uuid, public.moderation_case_status, smallint)', 'execute')
    or has_function_privilege('anon', 'public.issue_moderation_sanction(uuid, public.moderation_sanction_kind, integer, public.report_category)', 'execute')
    or has_function_privilege('anon', 'public.submit_moderation_appeal(uuid, text)', 'execute')
    or has_function_privilege('anon', 'public.review_moderation_appeal(uuid, public.moderation_appeal_status, text)', 'execute') then
    raise exception 'RPC modération accessible anonymement';
  end if;
end $$;

-- Dossier intercomptes ADR-0012 : 2=signaleur, 3=sujet, 4=modérateur,
-- 5=admin émetteur, 6=admin examinateur. Les comptes 2 à 5 existent déjà.
reset role;
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000006', '{"username":"safety-admin"}')
on conflict (id) do nothing;
insert into public.profiles (id, username, role)
values ('00000000-0000-0000-0000-000000000006', 'safety-admin', 'admin')
on conflict (id) do update set role = 'admin';
update public.profiles set role = case id
  when '00000000-0000-0000-0000-000000000004' then 'moderateur'::public.user_role
  when '00000000-0000-0000-0000-000000000005' then 'admin'::public.user_role
  else role end
where id in ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', false);

-- Le membre crée seulement son signalement ; le trigger crée son dossier.
insert into public.reports (reporter_id, video_id, reason, category)
select auth.uid(), v.id, 'signalement utilisateur', 'harcelement'
from public.videos v where v.author_id = '00000000-0000-0000-0000-000000000003' limit 1;

do $$
declare refus integer := 0;
begin
  begin insert into public.moderation_cases (report_id, category) values (gen_random_uuid(), 'spam'); exception when insufficient_privilege then refus := refus + 1; end;
  begin insert into public.moderation_sanctions (case_id, subject_id, issued_by, kind, reason) values (gen_random_uuid(), auth.uid(), auth.uid(), 'warning', 'spam'); exception when insufficient_privilege then refus := refus + 1; end;
  begin insert into public.moderation_appeals (sanction_id, appellant_id) values (gen_random_uuid(), auth.uid()); exception when insufficient_privilege then refus := refus + 1; end;
  begin insert into public.moderation_events (action) values ('sanction_issued'); exception when insufficient_privilege then refus := refus + 1; end;
  if refus <> 4 then raise exception 'mutation directe non bloquée (%/4)', refus; end if;
end $$;

-- Le modérateur peut trier et masquer, mais ne peut pas sanctionner.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', false);
do $$
declare v_case uuid; v_video uuid;
begin
  select mc.id, r.video_id into v_case, v_video from public.moderation_cases mc join public.reports r on r.id = mc.report_id order by mc.created_at desc limit 1;
  if not public.triage_moderation_case(v_case, 'triaged'::public.moderation_case_status, 2::smallint) then raise exception 'triage modérateur refusé'; end if;
  update public.videos set hidden = true where id = v_video;
  if not exists (select 1 from public.videos where id = v_video and hidden) then raise exception 'masquage modérateur refusé'; end if;
  if public.issue_moderation_sanction(v_case, 'warning'::public.moderation_sanction_kind, null, 'harcelement'::public.report_category) is not null then raise exception 'sanction modérateur acceptée'; end if;
end $$;

-- L'admin émet une restriction de 7 jours, le sujet la lit et ne peut appeler qu'une fois.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
do $$
declare v_case uuid; v_sanction uuid; v_days numeric;
begin
  select id into v_case from public.moderation_cases order by created_at desc limit 1;
  v_sanction := public.issue_moderation_sanction(v_case, 'mentorship_restriction'::public.moderation_sanction_kind, 7, 'harcelement'::public.report_category);
  if v_sanction is null then raise exception 'sanction admin refusée'; end if;
  select extract(epoch from (expires_at - issued_at)) / 86400 into v_days from public.moderation_sanctions where id = v_sanction;
  if v_days <> 7 then raise exception 'durée 7 jours absente (%)', v_days; end if;
  v_sanction := public.issue_moderation_sanction(v_case, 'mentorship_restriction'::public.moderation_sanction_kind, 30, 'harcelement'::public.report_category);
  select extract(epoch from (expires_at - issued_at)) / 86400 into v_days from public.moderation_sanctions where id = v_sanction;
  if v_days <> 30 then raise exception 'durée 30 jours absente (%)', v_days; end if;
  if public.issue_moderation_sanction(v_case, 'mentorship_restriction'::public.moderation_sanction_kind, 14, 'harcelement'::public.report_category) is not null then raise exception 'durée hors barème acceptée'; end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', false);
do $$
declare v_sanction uuid; v_appeal uuid; visibles integer;
begin
  select id into v_sanction from public.moderation_sanctions order by issued_at desc limit 1;
  select count(*) into visibles from public.moderation_sanctions where id = v_sanction;
  if visibles <> 1 then raise exception 'sanction du sujet non lisible'; end if;
  begin
    insert into public.mentor_offers (user_id, topics) values (auth.uid(), 'offre refusée par restriction');
    raise exception 'restriction mentorat contournable';
  exception when insufficient_privilege then null;
  end;
  v_appeal := public.submit_moderation_appeal(v_sanction, 'Je demande un réexamen humain de cette mesure et explique précisément mon contexte.');
  if v_appeal is null then raise exception 'appel du sujet refusé'; end if;
  if public.submit_moderation_appeal(v_sanction, 'Je tente un second appel mais la règle doit empêcher ce nouvel envoi. ') is not null then raise exception 'second appel accepté'; end if;
  if public.submit_moderation_appeal(v_sanction, 'trop court') is not null then raise exception 'appel trop court accepté'; end if;
end $$;

-- L'admin émetteur ne s'auto-réexamine pas ; un autre admin renverse et révoque.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000005', false);
do $$ declare v_appeal uuid; begin
  select id into v_appeal from public.moderation_appeals order by submitted_at desc limit 1;
  if public.review_moderation_appeal(v_appeal, 'overturned'::public.moderation_appeal_status, 'Une note de décision suffisamment détaillée mais auto-examen interdit.') then raise exception 'auto-réexamen accepté'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000006', false);
do $$
declare v_appeal uuid; v_sanction uuid; journal integer;
begin
  select id, sanction_id into v_appeal, v_sanction from public.moderation_appeals order by submitted_at desc limit 1;
  if not public.review_moderation_appeal(v_appeal, 'overturned'::public.moderation_appeal_status, 'Après examen indépendant, les éléments ne justifient pas le maintien de cette mesure.') then raise exception 'renversement second admin refusé'; end if;
  if exists (select 1 from public.moderation_sanctions where id = v_sanction and revoked_at is null) then raise exception 'sanction non révoquée'; end if;
  select count(*) into journal from public.moderation_events where sanction_id = v_sanction and action in ('sanction_issued', 'appeal_submitted', 'appeal_overturned', 'sanction_revoked');
  if journal <> 4 then raise exception 'journal inattendu (% événements)', journal; end if;
end $$;
-- La suppression d'un auteur puis du signaleur conserve le dossier, la
-- sanction et l'appel, mais anonymise toutes les références personnelles.
reset role;
delete from auth.users where id in ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003');
do $$
begin
  if not exists (select 1 from public.moderation_cases where report_id is null and subject_id is null) then raise exception 'dossier non conservé anonymisé'; end if;
  if not exists (select 1 from public.moderation_sanctions where subject_id is null) then raise exception 'sanction non conservée anonymisée'; end if;
  if not exists (select 1 from public.moderation_appeals where appellant_id is null) then raise exception 'appel non conservé anonymisé'; end if;
end $$;
reset role;
