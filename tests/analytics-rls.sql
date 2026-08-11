\set ON_ERROR_STOP on

-- À exécuter après tests/room-audio-rls.sql, qui crée les cinq comptes de test
-- et les grants `auth` du squelette PostgreSQL minimal.
--
-- Ce que la fixture doit prouver : la table d'événements produit est
-- inatteignable directement, la RPC est le seul chemin d'écriture, elle attribue
-- l'acteur depuis la session, les « premières fois » ne se comptent qu'une fois,
-- et la restitution agrégée est réservée aux rôles de modération.

reset role;
update public.profiles
set role = 'admin'
where id = '00000000-0000-0000-0000-000000000005';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

-- 1. Les quatre verbes directs sont refusés à un membre authentifié.
do $$
declare
  refus integer := 0;
begin
  begin
    perform 1 from public.product_events;
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  begin
    insert into public.product_events (actor_id, name, surface)
    values (auth.uid(), 'session_start', 'session');
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  begin
    update public.product_events set outcome = 'error' where actor_id = auth.uid();
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  begin
    delete from public.product_events where actor_id = auth.uid();
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  if refus <> 4 then
    raise exception 'table product_events atteignable directement (% refus sur 4)', refus;
  end if;
end;
$$;

-- 2. La RPC écrit, et elle attribue l'acteur depuis la session, pas depuis un
--    paramètre : aucun appelant ne peut écrire au nom d'autrui.
do $$
begin
  if not public.record_product_event('session_start', 'session') then
    raise exception 'RPC analytique refusée à un membre authentifié';
  end if;
  if not public.record_product_event('first_publish', 'video_publish') then
    raise exception 'première publication non enregistrée';
  end if;
  if not public.record_product_event(
    'action_refused', 'video_amen', 'refused', 'rate_limited'
  ) then
    raise exception 'refus applicatif non enregistré';
  end if;
end;
$$;

-- 3. Les répétitions ne créent pas de seconde ligne.
do $$
begin
  if public.record_product_event('first_publish', 'video_publish') then
    raise exception 'première publication comptée deux fois';
  end if;
  if public.record_product_event('session_start', 'session') then
    raise exception 'session du jour comptée deux fois';
  end if;
end;
$$;

reset role;
do $$
declare
  total integer;
  attribuees integer;
begin
  select count(*) into total from public.product_events;
  if total <> 3 then
    raise exception 'attendu 3 lignes après déduplication, trouvé %', total;
  end if;

  select count(*) into attribuees
  from public.product_events
  where actor_id = '00000000-0000-0000-0000-000000000001';
  if attribuees <> 3 then
    raise exception 'acteur non repris de la session (% lignes attribuées)', attribuees;
  end if;
end;
$$;

-- 4. Un second membre ne voit rien de la restitution agrégée ; un admin la voit.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

do $$
declare
  lignes integer;
begin
  select count(*) into lignes from public.product_events_daily;
  if lignes <> 0 then
    raise exception 'restitution agrégée visible par un membre (% lignes)', lignes;
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000005',
  false
);

do $$
declare
  lignes integer;
  evenements bigint;
begin
  select count(*) into lignes from public.product_events_daily;
  if lignes <> 3 then
    raise exception 'restitution agrégée incomplète pour un admin (% lignes)', lignes;
  end if;

  select sum(d.events) into evenements from public.product_events_daily d;
  if evenements <> 3 then
    raise exception 'agrégat incohérent (% événements)', evenements;
  end if;
end;
$$;

-- 5. La suppression du compte emporte ses événements : l'effacement est réel,
--    pas une anonymisation partielle.
reset role;
delete from public.profiles where id = '00000000-0000-0000-0000-000000000001';

do $$
declare
  restants integer;
begin
  select count(*) into restants
  from public.product_events
  where actor_id = '00000000-0000-0000-0000-000000000001';
  if restants <> 0 then
    raise exception 'événements survivants après suppression du profil (%)', restants;
  end if;
end;
$$;
