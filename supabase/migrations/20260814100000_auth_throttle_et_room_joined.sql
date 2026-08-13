-- Piste A — A2 (protection de l'entrée Auth) et A9 (mesure de l'entrée audio).
--
-- A2. Les Server Actions `login`, `signup` et la demande de réinitialisation
-- appellent Supabase Auth sans aucun frein applicatif : `consume_rate_limit`
-- exige `auth.uid()`, qui est nul avant authentification. Un attaquant peut
-- donc énumérer des mots de passe au rythme que le réseau permet, et déclencher
-- l'envoi d'e-mails jusqu'au plafond du fournisseur — c'est exactement ce qui a
-- été observé le 13 août 2026 (`over_email_send_rate_limit`).
--
-- Le frein est keyé sur l'adresse cliente, mais **l'adresse n'entre jamais en
-- base** : l'application transmet un condensé SHA-256 poivré par un secret
-- serveur. La base ne peut donc ni la lire, ni la retrouver par force brute
-- sans ce secret, et les lignes s'effacent avec leur fenêtre. Le frein protège
-- l'entrée sans transformer la table en journal de connexions.
--
-- Le schéma `private` n'est pas exposé par PostgREST : la table est hors
-- d'atteinte de l'API REST, comme `analytics_secrets`.

create table private.auth_throttle (
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  scope text not null check (scope in ('login', 'signup', 'password_reset')),
  window_started timestamptz not null,
  count integer not null check (count between 0 and 10000),
  primary key (ip_hash, scope)
);

revoke all on private.auth_throttle from public, anon, authenticated;

create index auth_throttle_window_idx on private.auth_throttle (window_started);

create or replace function private.consume_auth_attempt_impl(
  p_token text,
  p_ip_hash text,
  p_scope text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendu text;
  max_requests integer;
  window_seconds integer;
  bucket timestamptz;
begin
  if p_token is null or p_token = '' or p_ip_hash !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  select s.token_sha256 into attendu
  from private.analytics_secrets s
  where s.name = 'anonymous_events';
  if attendu is null
     or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> attendu then
    return false;
  end if;

  -- Plafonds volontairement larges : ils arrêtent l'automatisation, pas la
  -- personne qui se trompe deux fois de mot de passe. `signup` et
  -- `password_reset` sont plus stricts parce qu'ils consomment un quota
  -- d'e-mails partagé par tout le projet.
  case p_scope
    when 'login' then max_requests := 12; window_seconds := 900;
    when 'signup' then max_requests := 5; window_seconds := 3600;
    when 'password_reset' then max_requests := 3; window_seconds := 3600;
    else return false;
  end case;

  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into private.auth_throttle (ip_hash, scope, window_started, count)
  values (p_ip_hash, p_scope, bucket, 1)
  on conflict (ip_hash, scope) do update
    set window_started = excluded.window_started,
        count = case
          when private.auth_throttle.window_started < excluded.window_started then 1
          else private.auth_throttle.count + 1
        end
    where private.auth_throttle.window_started < excluded.window_started
       or private.auth_throttle.count < max_requests;

  return found;
end;
$$;

revoke all on function private.consume_auth_attempt_impl(text, text, text)
  from public, anon, authenticated;
grant execute on function private.consume_auth_attempt_impl(text, text, text)
  to anon, authenticated;

create or replace function public.consume_auth_attempt(
  p_token text,
  p_ip_hash text,
  p_scope text
) returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.consume_auth_attempt_impl(p_token, p_ip_hash, p_scope);
$$;

revoke all on function public.consume_auth_attempt(text, text, text) from public;
grant execute on function public.consume_auth_attempt(text, text, text)
  to anon, authenticated;

-- Les fenêtres périmées n'ont aucune valeur : les garder ferait de cette table
-- un historique de tentatives, ce qu'elle ne doit jamais devenir.
create or replace function private.purge_auth_throttle()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  supprimes integer;
begin
  delete from private.auth_throttle
  where window_started < now() - interval '2 hours';
  get diagnostics supprimes = row_count;
  return supprimes;
end;
$$;

revoke all on function private.purge_auth_throttle() from public, anon, authenticated;

-- A9. `room_opened` mesure le rendu de la page d'une salle, jamais l'entrée
-- volontaire dans l'audio. On ne pouvait donc pas distinguer un visiteur qui
-- lit les messages d'un participant vocal réel — la mesure la plus utile de
-- cette surface manquait.
alter type public.product_event_name add value if not exists 'room_joined';
