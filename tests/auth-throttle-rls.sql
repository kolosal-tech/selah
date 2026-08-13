\set ON_ERROR_STOP on

-- À exécuter après tests/anonymous-events-rls.sql, qui pose le jeton de test
-- `jeton-de-test-analytique` dans private.analytics_secrets.
--
-- Ce que la fixture doit prouver : la table de freinage est hors d'atteinte
-- d'un client, la RPC refuse tout appel sans le bon jeton ou avec un condensé
-- mal formé, le compteur s'incrémente jusqu'à sa limite puis refuse, et chaque
-- portée a son propre compteur.

reset role;

-- Deux condensés distincts, écrits en dur pour rester déterministes : la
-- fixture ne doit dépendre d'aucune adresse réelle.
\set hash_a '\'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\''
\set hash_b '\'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\''

set role anon;

-- 1. Ni la table ni son schéma ne sont atteignables depuis un client.
do $$
declare
  refus integer := 0;
begin
  begin
    perform 1 from private.auth_throttle;
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  begin
    insert into private.auth_throttle (ip_hash, scope, window_started, count)
    values (repeat('a', 64), 'login', now(), 1);
  exception when insufficient_privilege then
    refus := refus + 1;
  end;

  if refus <> 2 then
    raise exception 'table de freinage atteignable (% refus sur 2)', refus;
  end if;
end;
$$;

-- 2. Jeton absent, vide ou faux : toujours refusé. Un condensé mal formé aussi,
--    sans quoi un appelant pourrait forger une clé arbitraire.
do $$
begin
  if public.consume_auth_attempt(null, repeat('a', 64), 'login') then
    raise exception 'appel sans jeton accepté';
  end if;
  if public.consume_auth_attempt('mauvais', repeat('a', 64), 'login') then
    raise exception 'appel à jeton faux accepté';
  end if;
  if public.consume_auth_attempt('jeton-de-test-analytique', 'pas-un-condense', 'login') then
    raise exception 'condensé mal formé accepté';
  end if;
  if public.consume_auth_attempt('jeton-de-test-analytique', repeat('a', 64), 'inconnu') then
    raise exception 'portée inconnue acceptée';
  end if;
end;
$$;

-- 3. La portée `password_reset` accepte trois tentatives par heure, la
--    quatrième est refusée : c'est le quota d'e-mails du projet qu'elle protège.
do $$
declare
  i integer;
begin
  for i in 1..3 loop
    if not public.consume_auth_attempt(
      'jeton-de-test-analytique', repeat('a', 64), 'password_reset'
    ) then
      raise exception 'tentative % refusée avant la limite', i;
    end if;
  end loop;

  if public.consume_auth_attempt(
    'jeton-de-test-analytique', repeat('a', 64), 'password_reset'
  ) then
    raise exception 'quatrième réinitialisation acceptée malgré la limite de 3';
  end if;
end;
$$;

-- 4. Les portées ne se partagent pas leur compteur : une adresse bloquée sur
--    la réinitialisation doit pouvoir encore se connecter. Le plafond de
--    connexion est nettement plus haut, parce qu'un NAT partagé — une église
--    connectée au même réseau — est le cas nominal, pas une attaque.
do $$
declare
  i integer;
begin
  for i in 1..30 loop
    if not public.consume_auth_attempt(
      'jeton-de-test-analytique', repeat('a', 64), 'login'
    ) then
      raise exception 'connexion % refusée avant la limite de 30', i;
    end if;
  end loop;

  if public.consume_auth_attempt(
    'jeton-de-test-analytique', repeat('a', 64), 'login'
  ) then
    raise exception 'trente et unième connexion acceptée malgré la limite';
  end if;
end;
$$;

-- 5. Les adresses ne se partagent pas non plus leur compteur : bloquer une
--    adresse ne doit jamais bloquer tout le monde.
do $$
begin
  if not public.consume_auth_attempt(
    'jeton-de-test-analytique', repeat('b', 64), 'password_reset'
  ) then
    raise exception 'une seconde adresse hérite du compteur de la première';
  end if;
end;
$$;

reset role;
do $$
declare
  lignes integer;
  purgees integer;
begin
  select count(*) into lignes from private.auth_throttle;
  if lignes <> 3 then
    raise exception 'attendu 3 compteurs (2 portées x adresse a, 1 adresse b), trouvé %', lignes;
  end if;

  -- La purge ne touche pas une fenêtre courante : elle n'efface que l'ancien.
  select private.purge_auth_throttle() into purgees;
  if purgees <> 0 then
    raise exception 'la purge a effacé % fenêtres courantes', purgees;
  end if;

  update private.auth_throttle set window_started = now() - interval '3 hours';
  select private.purge_auth_throttle() into purgees;
  if purgees <> 3 then
    raise exception 'la purge a laissé des fenêtres périmées (% supprimées)', purgees;
  end if;
end;
$$;
