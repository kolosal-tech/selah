-- Vague 0 — Socle de mesure produit.
--
-- Contrainte de conception : aucune colonne libre. Chaque dimension est un type
-- énuméré fermé, donc il est structurellement impossible d'écrire ici le texte
-- d'une prière, un e-mail, une légende ou un identifiant externe. Ce n'est pas
-- une convention d'équipe, c'est le schéma qui refuse.
--
-- `actor_id` reste une donnée pseudonyme : elle est indispensable pour compter
-- « première publication » et un retour J1/J7/J30. Contreparties portées par
-- cette migration : aucune lecture par le client, cascade de suppression depuis
-- `profiles`, aucune jointure possible vers le contenu.

create type public.product_event_name as enum (
  'signup_completed',
  'session_start',
  'first_feed_view',
  'first_publish',
  'first_prayer',
  'room_opened',
  'action_refused'
);

-- Les surfaces couvrent les 14 portées de `consume_rate_limit` (dont
-- `translation` et `room_message`, qui n'existent qu'en base) plus les écrans
-- sans quota. Une surface manquante rendrait un refus invisible à la mesure.
create type public.product_event_surface as enum (
  'session',
  'auth',
  'feed',
  'discover',
  'videos',
  'profile',
  'moderation',
  'post',
  'comment',
  'prayer_request',
  'prayer_action',
  'report',
  'translation',
  'video_publish',
  'video_amen',
  'video_comment',
  'video_prayer',
  'follow',
  'room_create',
  'room_message',
  'challenge_create'
);

create type public.product_event_outcome as enum ('ok', 'refused', 'error');

create type public.product_event_reason as enum (
  'none',
  'rate_limited',
  'suspended',
  'invalid_input',
  'forbidden',
  'unavailable'
);

create table public.product_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  name public.product_event_name not null,
  surface public.product_event_surface not null,
  outcome public.product_event_outcome not null default 'ok',
  reason public.product_event_reason not null default 'none',
  occurred_at timestamptz not null default now(),
  -- Le jour est matérialisé plutôt que calculé : une expression sur
  -- `occurred_at` obligerait l'index unique à dépendre du fuseau de session.
  occurred_day date not null default (now() at time zone 'utc')::date
);

alter table public.product_events enable row level security;

-- Aucune policy permissive n'est créée : RLS activée sans policy refuse tout.
-- Les deux policies ci-dessous rendent ce refus explicite et lisible en revue.
create policy "événements produit jamais lus par un client"
  on public.product_events for select to authenticated using (false);
create policy "événements produit jamais écrits directement"
  on public.product_events for insert to authenticated with check (false);

revoke all on public.product_events from anon, authenticated;

create index product_events_actor_recent_idx
  on public.product_events (actor_id, occurred_at desc);
create index product_events_reporting_idx
  on public.product_events (occurred_day, name);

-- Une première fois ne se produit qu'une fois : l'unicité est en base, pas dans
-- une condition applicative qui perdrait la course entre deux onglets.
create unique index product_events_first_idx
  on public.product_events (actor_id, name)
  where name in ('signup_completed', 'first_feed_view', 'first_publish', 'first_prayer');

-- Une visite quotidienne suffit à mesurer la rétention ; conserver chaque
-- navigation produirait un volume sans usage.
create unique index product_events_session_idx
  on public.product_events (actor_id, occurred_day)
  where name = 'session_start';

create or replace function private.record_product_event_impl(
  p_name text,
  p_surface text,
  p_outcome text,
  p_reason text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  recent integer;
begin
  if actor is null then
    return false;
  end if;

  -- Plafond de volume par acteur : une boucle client ne doit pas pouvoir
  -- gonfler la table. La mesure est un confort, jamais une priorité.
  select count(*) into recent
  from public.product_events
  where actor_id = actor and occurred_at > now() - interval '1 minute';
  if recent >= 60 then
    return false;
  end if;

  insert into public.product_events (actor_id, name, surface, outcome, reason)
  values (
    actor,
    p_name::public.product_event_name,
    p_surface::public.product_event_surface,
    coalesce(p_outcome, 'ok')::public.product_event_outcome,
    coalesce(p_reason, 'none')::public.product_event_reason
  )
  on conflict do nothing;

  return found;
end;
$$;

revoke all on function private.record_product_event_impl(text, text, text, text)
  from public, anon;
grant execute on function private.record_product_event_impl(text, text, text, text)
  to authenticated;

create or replace function public.record_product_event(
  p_name text,
  p_surface text,
  p_outcome text default 'ok',
  p_reason text default 'none'
) returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.record_product_event_impl(p_name, p_surface, p_outcome, p_reason);
$$;

revoke all on function public.record_product_event(text, text, text, text)
  from public, anon;
grant execute on function public.record_product_event(text, text, text, text)
  to authenticated;

-- Restitution : agrégats seuls, jamais la ligne. La segmentation par langue lit
-- `profiles.lang`, seule colonne de langue que le client peut faire évoluer
-- (`profiles.locale` est figée à l'inscription et hors du grant d'écriture).
create or replace function private.product_events_daily_rows()
returns table (
  day date,
  name public.product_event_name,
  surface public.product_event_surface,
  outcome public.product_event_outcome,
  reason public.product_event_reason,
  lang text,
  events bigint,
  actors bigint
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
    select
      e.occurred_day,
      e.name,
      e.surface,
      e.outcome,
      e.reason,
      p.lang,
      count(*)::bigint,
      count(distinct e.actor_id)::bigint
    from public.product_events e
    join public.profiles p on p.id = e.actor_id
    group by 1, 2, 3, 4, 5, 6;
end;
$$;

revoke all on function private.product_events_daily_rows() from public, anon;
grant execute on function private.product_events_daily_rows() to authenticated;

create or replace view public.product_events_daily
with (security_invoker = true, security_barrier = true) as
  select * from private.product_events_daily_rows();

revoke all on public.product_events_daily from anon;
grant select on public.product_events_daily to authenticated;

-- Rétention : 400 jours couvre une comparaison année sur année. La purge est
-- livrée mais volontairement non planifiée — aucun `pg_cron` n'est installé sur
-- ce projet, et en installer un est une décision d'exploitation, pas un effet
-- de bord de migration.
create or replace function private.purge_product_events(p_days integer default 400)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  supprimes integer;
begin
  delete from public.product_events
  where occurred_at < now() - make_interval(days => greatest(p_days, 30));
  get diagnostics supprimes = row_count;
  return supprimes;
end;
$$;

revoke all on function private.purge_product_events(integer) from public, anon, authenticated;
