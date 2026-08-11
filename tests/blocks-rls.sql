\set ON_ERROR_STOP on

-- À exécuter après tests/anonymous-events-rls.sql.
--
-- Ce que la fixture doit prouver : une liste de blocage n'est lisible que par
-- son propriétaire, le blocage empêche réellement l'abonnement, les trois
-- gestes ont trois effets distincts sur le fil, et personne ne peut se bloquer
-- soi-même ni bloquer au nom d'autrui.
--
-- Le compte 1 a été supprimé par tests/analytics-rls.sql ; on travaille donc
-- avec les comptes 2 (lecteur), 3 (auteur gênant) et 4 (auteur ordinaire).

reset role;

insert into public.videos (author_id, storage_path, caption, duration_s)
values
  ('00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000003/genant.mp4', 'auteur gênant', 30),
  ('00000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000004/ordinaire.mp4', 'auteur ordinaire', 30);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

-- 1. Le fil montre les deux auteurs avant tout geste.
do $$
declare
  visibles integer;
begin
  select count(*) into visibles from public.videos_feed;
  if visibles <> 2 then
    raise exception 'fil de départ inattendu (% vidéos)', visibles;
  end if;
end;
$$;

-- 2. Se bloquer soi-même, ou bloquer au nom d'un autre, est refusé.
do $$
declare
  refus integer := 0;
begin
  begin
    insert into public.user_blocks (blocker_id, blocked_id, kind)
    values (auth.uid(), auth.uid(), 'block');
  exception when check_violation then
    refus := refus + 1;
  end;

  begin
    insert into public.user_blocks (blocker_id, blocked_id, kind)
    values (
      '00000000-0000-0000-0000-000000000004',
      '00000000-0000-0000-0000-000000000003',
      'block'
    );
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  if refus <> 2 then
    raise exception 'blocage abusif accepté (% refus sur 2)', refus;
  end if;
end;
$$;

-- 3. La sourdine retire l'auteur du fil.
insert into public.user_blocks (blocker_id, blocked_id, kind)
values (auth.uid(), '00000000-0000-0000-0000-000000000003', 'mute');

do $$
declare
  visibles integer;
begin
  select count(*) into visibles from public.videos_feed;
  if visibles <> 1 then
    raise exception 'sourdine sans effet sur le fil (% vidéos)', visibles;
  end if;
end;
$$;

-- 4. « Moins intéressant » garde l'auteur mais amortit son score : retirer un
--    auteur seulement moins intéressant priverait d'un retour possible.
update public.user_blocks set kind = 'not_interested'
where blocker_id = auth.uid()
  and blocked_id = '00000000-0000-0000-0000-000000000003';

do $$
declare
  visibles integer;
  score_amorti numeric;
  score_normal numeric;
begin
  select count(*) into visibles from public.videos_feed;
  if visibles <> 2 then
    raise exception '« moins intéressant » retire l''auteur du fil (% vidéos)', visibles;
  end if;

  select score into score_amorti from public.videos_feed
  where author_id = '00000000-0000-0000-0000-000000000003';
  select score into score_normal from public.videos_feed
  where author_id = '00000000-0000-0000-0000-000000000004';
  if score_amorti >= score_normal then
    raise exception 'score non amorti (% contre %)', score_amorti, score_normal;
  end if;
end;
$$;

-- 5. Le blocage empêche l'abonnement de la personne bloquée, et le contrôle
--    est en base : une garde applicative seule serait contournable.
update public.user_blocks set kind = 'block'
where blocker_id = auth.uid()
  and blocked_id = '00000000-0000-0000-0000-000000000003';

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  false
);

do $$
declare
  refuse boolean := false;
begin
  begin
    insert into public.follows (follower_id, followed_id)
    values (auth.uid(), '00000000-0000-0000-0000-000000000002');
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'une personne bloquée peut encore suivre celui qui l''a bloquée';
  end if;
end;
$$;

-- 6. Une liste de blocage est une confidence : la personne bloquée ne doit pas
--    pouvoir la lire. Savoir qu'on est bloqué est ce qui déclenche le
--    contournement.
do $$
declare
  visibles integer;
begin
  select count(*) into visibles from public.user_blocks;
  if visibles <> 0 then
    raise exception 'liste de blocage lisible par la personne bloquée (%)', visibles;
  end if;
end;
$$;

-- 7. Un blocage n'est pas réciproque : le compte 3 voit toujours le fil, il ne
--    subit pas une exclusion qu'il n'a pas choisie.
do $$
declare
  visibles integer;
begin
  select count(*) into visibles from public.videos_feed;
  if visibles <> 2 then
    raise exception 'blocage appliqué à tort dans le sens inverse (% vidéos)', visibles;
  end if;
end;
$$;

-- 8. La catégorie de signalement est écrite par l'auteur du signalement, dans
--    la liste fermée, et le statut reste hors de sa portée.
insert into public.reports (reporter_id, video_id, reason, category)
select auth.uid(), v.id, 'contenu inapproprié', 'harcelement'
from public.videos v
where v.author_id = '00000000-0000-0000-0000-000000000004'
limit 1;

do $$
declare
  refuse boolean := false;
begin
  begin
    insert into public.reports (reporter_id, video_id, reason, category, status)
    select auth.uid(), v.id, 'contenu inapproprié', 'spam', 'traite'
    from public.videos v
    where v.author_id = '00000000-0000-0000-0000-000000000004'
    limit 1;
  exception when insufficient_privilege then
    refuse := true;
  end;
  if not refuse then
    raise exception 'un signaleur peut clore son propre signalement';
  end if;
end;
$$;

reset role;
do $$
declare
  categorie text;
begin
  select category into categorie from public.reports limit 1;
  if categorie <> 'harcelement' then
    raise exception 'catégorie de signalement non conservée (%)', categorie;
  end if;
end;
$$;
