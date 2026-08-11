-- Vague 0 (complément) — Mesurer ce qu'aucun compte authentifié ne peut signaler.
--
-- `product_events` est réservée à `authenticated` et son `actor_id` est NOT
-- NULL : un échec de connexion, un échec d'inscription ou un abandon avant
-- authentification n'y ont pas de place. Les métriques terrain LCP/INP/CLS
-- naissent également dans un navigateur qui n'a pas toujours de session.
--
-- Cette seconde voie est volontairement séparée et n'a **aucune** colonne
-- d'acteur : elle ne contient donc aucune donnée personnelle, pas même
-- pseudonyme. Elle est protégée par un jeton partagé détenu uniquement côté
-- serveur, et non par la clé `service_role` : cette dernière contourne la RLS
-- sur toute la base, alors que le jeton d'analytique ne permet qu'une chose,
-- insérer une ligne de compteur. Compromission = compteurs faussés, jamais de
-- fuite. Arbitrage consigné dans `docs/adr/ADR-0010-voie-anonyme-et-rum.md`.

create type public.anonymous_event_name as enum (
  'login_failed',
  'signup_failed',
  'password_reset_requested',
  'web_vital'
);

create type public.web_vital_metric as enum ('lcp', 'inp', 'cls');

-- Les seuils de web.dev, et rien d'autre. Une valeur brute de LCP contribuerait
-- à identifier un appareil ; trois paliers ne le permettent pas.
create type public.web_vital_bucket as enum ('good', 'needs_improvement', 'poor');

create table public.anonymous_events (
  id bigint generated always as identity primary key,
  name public.anonymous_event_name not null,
  surface public.product_event_surface not null,
  metric public.web_vital_metric,
  bucket public.web_vital_bucket,
  occurred_at timestamptz not null default now(),
  occurred_day date not null default (now() at time zone 'utc')::date,
  -- Une métrique terrain sans palier, ou un palier sans métrique, serait une
  -- ligne inexploitable : la cohérence est une contrainte, pas une convention.
  constraint anonymous_events_vital_coherent check (
    (name = 'web_vital' and metric is not null and bucket is not null)
    or (name <> 'web_vital' and metric is null and bucket is null)
  )
);

alter table public.anonymous_events enable row level security;

create policy "compteurs anonymes jamais lus par un client"
  on public.anonymous_events for select to anon, authenticated using (false);
create policy "compteurs anonymes jamais écrits directement"
  on public.anonymous_events for insert to anon, authenticated with check (false);

revoke all on public.anonymous_events from anon, authenticated;

create index anonymous_events_reporting_idx
  on public.anonymous_events (occurred_day, name);

-- Le jeton n'est jamais stocké en clair : seul son condensé permet de vérifier
-- un appel, et lire la base ne donne pas de quoi en forger un.
create table private.analytics_secrets (
  name text primary key,
  token_sha256 text not null check (token_sha256 ~ '^[0-9a-f]{64}$'),
  rotated_at timestamptz not null default now()
);

revoke all on private.analytics_secrets from public, anon, authenticated;

create or replace function private.record_anonymous_event_impl(
  p_token text,
  p_name text,
  p_surface text,
  p_metric text,
  p_bucket text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attendu text;
  recent integer;
begin
  if p_token is null or p_token = '' then
    return false;
  end if;

  select s.token_sha256 into attendu
  from private.analytics_secrets s
  where s.name = 'anonymous_events';
  if attendu is null then
    return false;
  end if;

  -- Comparaison sur le condensé : le jeton en clair ne transite qu'en argument
  -- et n'est jamais conservé.
  if encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> attendu then
    return false;
  end if;

  -- Plafond global : ces compteurs n'ont pas d'acteur, donc pas de quota par
  -- compte. Le débit total borne l'empoisonnement à un volume connu.
  select count(*) into recent
  from public.anonymous_events
  where occurred_at > now() - interval '1 minute';
  if recent >= 600 then
    return false;
  end if;

  insert into public.anonymous_events (name, surface, metric, bucket)
  values (
    p_name::public.anonymous_event_name,
    p_surface::public.product_event_surface,
    nullif(p_metric, '')::public.web_vital_metric,
    nullif(p_bucket, '')::public.web_vital_bucket
  );

  return true;
end;
$$;

revoke all on function private.record_anonymous_event_impl(text, text, text, text, text)
  from public, anon, authenticated;

create or replace function public.record_anonymous_event(
  p_token text,
  p_name text,
  p_surface text,
  p_metric text default null,
  p_bucket text default null
) returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.record_anonymous_event_impl(p_token, p_name, p_surface, p_metric, p_bucket);
$$;

-- Exécutable par un visiteur non authentifié : l'appel vient d'une route
-- serveur qui détient le jeton, jamais du navigateur.
revoke all on function public.record_anonymous_event(text, text, text, text, text) from public;
grant execute on function public.record_anonymous_event(text, text, text, text, text)
  to anon, authenticated;

create or replace function private.anonymous_events_daily_rows()
returns table (
  day date,
  name public.anonymous_event_name,
  surface public.product_event_surface,
  metric public.web_vital_metric,
  bucket public.web_vital_bucket,
  events bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderateur', 'admin')
  ) then
    return;
  end if;

  return query
    select e.occurred_day, e.name, e.surface, e.metric, e.bucket, count(*)::bigint
    from public.anonymous_events e
    group by 1, 2, 3, 4, 5;
end;
$$;

revoke all on function private.anonymous_events_daily_rows() from public, anon;
grant execute on function private.anonymous_events_daily_rows() to authenticated;

create or replace view public.anonymous_events_daily
with (security_invoker = true, security_barrier = true) as
  select * from private.anonymous_events_daily_rows();

revoke all on public.anonymous_events_daily from anon;
grant select on public.anonymous_events_daily to authenticated;

create or replace function private.purge_anonymous_events(p_days integer default 400)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  supprimes integer;
begin
  delete from public.anonymous_events
  where occurred_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics supprimes = row_count;
  return supprimes;
end;
$$;

revoke all on function private.purge_anonymous_events(integer)
  from public, anon, authenticated;
