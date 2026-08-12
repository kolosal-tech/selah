-- Cycle de vie du compte. L'export est propriétaire, la suppression est différée
-- de quatorze jours et toute trace durable de suppression est non identifiante.

create type public.account_deletion_status as enum ('pending', 'processing', 'failed');

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  execute_after timestamptz not null default (now() + interval '14 days'),
  status public.account_deletion_status not null default 'pending',
  claimed_at timestamptz,
  attempts smallint not null default 0 check (attempts >= 0 and attempts <= 10),
  failure_code text check (failure_code is null or char_length(failure_code) <= 80),
  check ((status = 'pending' and claimed_at is null and failure_code is null) or status in ('processing', 'failed'))
);
create index account_deletion_requests_due_idx on public.account_deletion_requests (status, execute_after);
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy "voir sa demande de suppression" on public.account_deletion_requests for select to authenticated using (user_id = auth.uid());

-- Aucun identifiant de membre ni e-mail : ce reçu n'est qu'une preuve
-- opérationnelle de purge, conservée un an conformément à ADR-0013.
create table public.account_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  completed_at timestamptz not null default now(),
  storage_objects_deleted integer not null default 0 check (storage_objects_deleted >= 0),
  result text not null check (result in ('deleted', 'already_deleted', 'failed')),
  failure_code text check (failure_code is null or char_length(failure_code) <= 80)
);
alter table public.account_deletion_receipts enable row level security;
revoke all on public.account_deletion_receipts from anon, authenticated;

-- Historique volontairement grossier : aucun IP, user-agent brut, ni géolocalisation.
create table public.account_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  browser_family text not null check (browser_family in ('chrome', 'safari', 'firefox', 'edge', 'other')),
  device_type text not null check (device_type in ('mobile', 'tablet', 'desktop', 'other')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, session_id),
  check (last_seen_at >= first_seen_at)
);
alter table public.account_sessions enable row level security;
revoke all on public.account_sessions from anon, authenticated;
grant select on public.account_sessions to authenticated;
create policy "voir ses sessions" on public.account_sessions for select to authenticated using (user_id = auth.uid());

create or replace function private.request_account_deletion()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.account_deletion_requests (user_id) values (auth.uid())
  on conflict (user_id) do update
    set requested_at = excluded.requested_at,
        execute_after = excluded.execute_after,
        status = 'pending',
        claimed_at = null,
        attempts = 0,
        failure_code = null;
  return true;
end $$;

create or replace function private.cancel_account_deletion()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.account_deletion_requests where user_id = auth.uid() and status in ('pending', 'failed');
  return found;
end $$;

create or replace function private.record_account_session(p_browser_family text, p_device_type text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid;
begin
  if auth.uid() is null then return false; end if;
  v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  if v_session_id is null
    or p_browser_family not in ('chrome', 'safari', 'firefox', 'edge', 'other')
    or p_device_type not in ('mobile', 'tablet', 'desktop', 'other') then return false; end if;
  insert into public.account_sessions (user_id, session_id, browser_family, device_type)
  values (auth.uid(), v_session_id, p_browser_family, p_device_type)
  on conflict (user_id, session_id) do update set last_seen_at = now();
  return true;
end $$;

create or replace function private.revoke_account_sessions(p_scope text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_session_id uuid;
begin
  if auth.uid() is null or p_scope not in ('others', 'global') then return false; end if;
  v_session_id := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  if p_scope = 'others' and v_session_id is null then return false; end if;
  update public.account_sessions set revoked_at = now()
  where user_id = auth.uid() and revoked_at is null
    and (p_scope = 'global' or session_id <> v_session_id);
  return true;
end $$;

-- Une liste exhaustive et explicite : aucune jointure cachée ni donnée d'un tiers.
create or replace function private.export_my_account()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = auth.uid()),
    'posts', coalesce((select jsonb_agg(to_jsonb(x) - 'author_id' order by x.created_at) from public.posts x where x.author_id = auth.uid()), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(to_jsonb(x) - 'author_id' order by x.created_at) from public.comments x where x.author_id = auth.uid()), '[]'::jsonb),
    'prayer_requests', coalesce((select jsonb_agg(to_jsonb(x) - 'author_id' order by x.created_at) from public.prayer_requests x where x.author_id = auth.uid()), '[]'::jsonb),
    'mentor_offers', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.created_at) from public.mentor_offers x where x.user_id = auth.uid()), '[]'::jsonb),
    'mentorships', coalesce((select jsonb_agg(to_jsonb(x) - 'mentor_id' - 'mentee_id' order by x.created_at) from public.mentorships x where x.mentor_id = auth.uid() or x.mentee_id = auth.uid()), '[]'::jsonb),
    'reports', coalesce((select jsonb_agg(to_jsonb(x) - 'reporter_id' order by x.created_at) from public.reports x where x.reporter_id = auth.uid()), '[]'::jsonb),
    'sanctions', coalesce((select jsonb_agg(to_jsonb(x) - 'subject_id' order by x.issued_at) from public.moderation_sanctions x where x.subject_id = auth.uid()), '[]'::jsonb),
    'appeals', coalesce((select jsonb_agg(to_jsonb(x) - 'appellant_id' order by x.submitted_at) from public.moderation_appeals x where x.appellant_id = auth.uid()), '[]'::jsonb)
  ) where auth.uid() is not null
$$;

-- Seul le Cron avec service_role peut réclamer un lot ; les UUID ne sont jamais
-- retournés à un navigateur et le travail est idempotent côté route.
create or replace function private.claim_due_account_deletions(p_limit integer default 10)
returns table (request_id uuid, user_id uuid) language plpgsql security definer set search_path = '' as $$
begin
  return query
  with due as (
    select id from public.account_deletion_requests
    where status in ('pending', 'failed') and execute_after <= now()
    order by execute_after asc limit greatest(1, least(p_limit, 25))
    for update skip locked
  )
  update public.account_deletion_requests r set status = 'processing', claimed_at = now(), attempts = r.attempts + 1, failure_code = null
  from due where r.id = due.id returning r.id, r.user_id;
end $$;

create or replace function private.finish_account_deletion(p_request_id uuid, p_deleted integer, p_result text, p_failure_code text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_result not in ('deleted', 'already_deleted', 'failed') then return false; end if;
  insert into public.account_deletion_receipts (storage_objects_deleted, result, failure_code)
  values (greatest(p_deleted, 0), p_result, left(nullif(p_failure_code, ''), 80));
  if p_result = 'failed' then
    update public.account_deletion_requests set status = 'failed', claimed_at = null, failure_code = left(nullif(p_failure_code, ''), 80) where id = p_request_id;
  else
    delete from public.account_deletion_requests where id = p_request_id;
  end if;
  return true;
end $$;

revoke all on function private.request_account_deletion(), private.cancel_account_deletion(), private.record_account_session(text, text), private.revoke_account_sessions(text), private.export_my_account(), private.claim_due_account_deletions(integer), private.finish_account_deletion(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function private.request_account_deletion(), private.cancel_account_deletion(), private.record_account_session(text, text), private.revoke_account_sessions(text), private.export_my_account() to authenticated;
grant execute on function private.claim_due_account_deletions(integer), private.finish_account_deletion(uuid, integer, text, text) to service_role;
grant usage on schema private to service_role;

create or replace function public.request_account_deletion() returns boolean language sql security invoker set search_path = '' as $$ select private.request_account_deletion() $$;
create or replace function public.cancel_account_deletion() returns boolean language sql security invoker set search_path = '' as $$ select private.cancel_account_deletion() $$;
create or replace function public.record_account_session(p_browser_family text, p_device_type text) returns boolean language sql security invoker set search_path = '' as $$ select private.record_account_session(p_browser_family, p_device_type) $$;
create or replace function public.revoke_account_sessions(p_scope text) returns boolean language sql security invoker set search_path = '' as $$ select private.revoke_account_sessions(p_scope) $$;
create or replace function public.export_my_account() returns jsonb language sql security invoker set search_path = '' as $$ select private.export_my_account() $$;
create or replace function public.claim_due_account_deletions(p_limit integer default 10) returns table (request_id uuid, user_id uuid) language sql security invoker set search_path = '' as $$ select * from private.claim_due_account_deletions(p_limit) $$;
create or replace function public.finish_account_deletion(p_request_id uuid, p_deleted integer, p_result text, p_failure_code text default null) returns boolean language sql security invoker set search_path = '' as $$ select private.finish_account_deletion(p_request_id, p_deleted, p_result, p_failure_code) $$;
revoke all on function public.request_account_deletion(), public.cancel_account_deletion(), public.record_account_session(text, text), public.revoke_account_sessions(text), public.export_my_account(), public.claim_due_account_deletions(integer), public.finish_account_deletion(uuid, integer, text, text) from public, anon;
grant execute on function public.request_account_deletion(), public.cancel_account_deletion(), public.record_account_session(text, text), public.revoke_account_sessions(text), public.export_my_account() to authenticated;
grant execute on function public.claim_due_account_deletions(integer), public.finish_account_deletion(uuid, integer, text, text) to service_role;
