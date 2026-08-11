\set ON_ERROR_STOP on

-- À exécuter après tests/analytics-rls.sql.
--
-- Ce que la fixture doit prouver : la table de compteurs anonymes est
-- inatteignable directement, la RPC refuse tout appel sans le bon jeton,
-- l'incohérence métrique/palier est rejetée par la contrainte, et la
-- restitution agrégée reste réservée aux rôles de modération.

reset role;

-- Jeton de test uniquement : condensé SHA-256 de la chaîne
-- 'jeton-de-test-analytique', calculé par la base elle-même pour qu'aucune
-- valeur en clair ne soit recopiée ailleurs que dans cette fixture.
insert into private.analytics_secrets (name, token_sha256)
values (
  'anonymous_events',
  encode(sha256(convert_to('jeton-de-test-analytique', 'UTF8')), 'hex')
);

-- Un visiteur non authentifié : c'est le cas nominal de cette voie.
set role anon;

do $$
declare
  refus integer := 0;
begin
  begin
    perform 1 from public.anonymous_events;
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  begin
    insert into public.anonymous_events (name, surface) values ('login_failed', 'auth');
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  begin
    perform private.record_anonymous_event_impl('x', 'login_failed', 'auth', null, null);
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  if refus <> 3 then
    raise exception 'voie anonyme atteignable directement (% refus sur 3)', refus;
  end if;
end;
$$;

-- Sans jeton, avec un jeton vide ou avec un jeton faux : toujours refusé.
do $$
begin
  if public.record_anonymous_event(null, 'login_failed', 'auth') then
    raise exception 'appel sans jeton accepté';
  end if;
  if public.record_anonymous_event('', 'login_failed', 'auth') then
    raise exception 'appel à jeton vide accepté';
  end if;
  if public.record_anonymous_event('mauvais-jeton', 'login_failed', 'auth') then
    raise exception 'appel à jeton faux accepté';
  end if;
end;
$$;

-- Avec le bon jeton, l'écriture passe, y compris pour une métrique terrain.
do $$
begin
  if not public.record_anonymous_event(
    'jeton-de-test-analytique', 'login_failed', 'auth'
  ) then
    raise exception 'échec de connexion non enregistré malgré un jeton valide';
  end if;
  if not public.record_anonymous_event(
    'jeton-de-test-analytique', 'web_vital', 'auth', 'lcp', 'good'
  ) then
    raise exception 'métrique terrain non enregistrée';
  end if;
end;
$$;

-- Une métrique sans palier produirait une ligne inexploitable : la contrainte
-- doit la rejeter, et l'erreur ne doit pas être une violation de privilège.
do $$
declare
  rejete boolean := false;
begin
  begin
    perform public.record_anonymous_event(
      'jeton-de-test-analytique', 'web_vital', 'auth', 'lcp', null
    );
  exception when check_violation then
    rejete := true;
  end;
  if not rejete then
    raise exception 'métrique terrain sans palier acceptée';
  end if;
end;
$$;

reset role;
do $$
declare
  total integer;
  avec_acteur integer;
begin
  select count(*) into total from public.anonymous_events;
  if total <> 2 then
    raise exception 'attendu 2 compteurs anonymes, trouvé %', total;
  end if;

  -- La garantie centrale de cette voie : aucune colonne d'acteur n'existe.
  select count(*) into avec_acteur
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'anonymous_events'
    and column_name in ('actor_id', 'user_id', 'ip', 'user_agent', 'session_id');
  if avec_acteur <> 0 then
    raise exception 'la voie anonyme porte une colonne identifiante (%)', avec_acteur;
  end if;
end;
$$;

-- Restitution : invisible pour un membre, lisible pour un admin. Le compte 5 a
-- été promu admin par tests/analytics-rls.sql.
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
  select count(*) into lignes from public.anonymous_events_daily;
  if lignes <> 0 then
    raise exception 'compteurs anonymes visibles par un membre (% lignes)', lignes;
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
begin
  select count(*) into lignes from public.anonymous_events_daily;
  if lignes <> 2 then
    raise exception 'restitution anonyme incomplète pour un admin (% lignes)', lignes;
  end if;
end;
$$;

reset role;
