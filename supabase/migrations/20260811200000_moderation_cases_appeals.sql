-- ADR-0012 — dossiers, mesures humaines réversibles et appels.
-- Aucun bannissement, suppression ou automatisme n'est représentable ici.

create schema if not exists private;

create type public.moderation_case_status as enum ('open', 'triaged', 'closed');
create type public.moderation_sanction_kind as enum ('warning', 'mentorship_restriction');
create type public.moderation_appeal_status as enum ('pending', 'upheld', 'overturned');

create table public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  report_id uuid unique references public.reports(id) on delete set null,
  subject_id uuid references public.profiles(id) on delete set null,
  category public.report_category not null,
  status public.moderation_case_status not null default 'open',
  priority smallint not null default 0 check (priority between 0 and 2),
  triaged_by uuid references public.profiles(id) on delete set null,
  triaged_at timestamptz,
  created_at timestamptz not null default now(),
  constraint moderation_case_triage_consistent check (
    (status = 'open' and triaged_by is null and triaged_at is null)
    or (status in ('triaged', 'closed') and triaged_at is not null)
  )
);
create table public.moderation_sanctions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.moderation_cases(id) on delete restrict,
  subject_id uuid references public.profiles(id) on delete set null,
  issued_by uuid references public.profiles(id) on delete set null,
  kind public.moderation_sanction_kind not null,
  reason public.report_category not null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete set null,
  constraint moderation_sanction_duration check (
    (kind = 'warning' and expires_at is null)
    or (kind = 'mentorship_restriction' and expires_at in (issued_at + interval '7 days', issued_at + interval '30 days'))
  ),
  constraint moderation_sanction_revocation check (
    (revoked_at is null and revoked_by is null) or revoked_at is not null
  )
);
create table public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  sanction_id uuid not null unique references public.moderation_sanctions(id) on delete restrict,
  appellant_id uuid references public.profiles(id) on delete set null,
  statement text not null check (char_length(btrim(statement)) between 20 and 2000),
  status public.moderation_appeal_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_note text,
  constraint moderation_appeal_decision_consistent check (
    (status = 'pending' and decided_at is null and decided_by is null and decision_note is null)
    or (status in ('upheld', 'overturned') and decided_at is not null and char_length(btrim(decision_note)) between 20 and 2000)
  )
);

alter table public.moderation_events add column case_id uuid references public.moderation_cases(id) on delete set null;
alter table public.moderation_events add column sanction_id uuid references public.moderation_sanctions(id) on delete set null;
alter table public.moderation_events add column appeal_id uuid references public.moderation_appeals(id) on delete set null;
alter table public.moderation_events drop constraint if exists moderation_events_action_check;
alter table public.moderation_events add constraint moderation_events_action_check check (action in (
  'report_created', 'report_status_changed', 'video_hidden_changed', 'case_created',
  'case_triaged', 'sanction_issued', 'appeal_submitted', 'appeal_upheld', 'appeal_overturned', 'sanction_revoked'
));

alter table public.moderation_cases enable row level security;
alter table public.moderation_sanctions enable row level security;
alter table public.moderation_appeals enable row level security;
revoke all on public.moderation_cases, public.moderation_sanctions, public.moderation_appeals from anon, authenticated;
grant select on public.moderation_cases to authenticated;
grant select on public.moderation_sanctions, public.moderation_appeals to authenticated;
create policy "modération lit les dossiers" on public.moderation_cases for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur', 'admin'))
);
create policy "modération lit les sanctions" on public.moderation_sanctions for select to authenticated using (
  subject_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur', 'admin'))
);
create policy "modération lit les appels" on public.moderation_appeals for select to authenticated using (
  appellant_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur', 'admin'))
);

-- Les accès directs restent strictement limités aux deux gestes existants.
revoke update on public.reports from authenticated;
grant select on public.reports to authenticated;
grant update (status) on public.reports to authenticated;
drop policy if exists "modérateurs traitent" on public.reports;
create policy "modérateurs traitent le statut" on public.reports for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur', 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur', 'admin')));
revoke update on public.videos from authenticated;
grant select on public.videos to authenticated;
grant update (hidden) on public.videos to authenticated;
drop policy if exists "modérer une vidéo" on public.videos;
create policy "modérer une vidéo" on public.videos for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur', 'admin')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('moderateur', 'admin')));

-- Les anciennes fonctions de trigger ne restent pas exposées dans public.
alter function public.validate_report_target() set schema private;
alter function public.log_report_event() set schema private;
alter function public.log_video_moderation_event() set schema private;

create or replace function private.create_moderation_case() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_subject uuid;
begin
  select coalesce(v.author_id, po.author_id, c.author_id) into v_subject
  from public.reports r
  left join public.videos v on v.id = r.video_id
  left join public.posts po on po.id = r.post_id
  left join public.comments c on c.id = r.comment_id
  where r.id = new.id;
  insert into public.moderation_cases (report_id, subject_id, category)
  values (new.id, v_subject, new.category)
  on conflict (report_id) do nothing;
  insert into public.moderation_events (report_id, case_id, actor_id, action, after_state)
  select new.id, mc.id, new.reporter_id, 'case_created', jsonb_build_object('category', new.category)
  from public.moderation_cases mc where mc.report_id = new.id;
  return new;
end $$;
create trigger reports_create_moderation_case after insert on public.reports
  for each row execute function private.create_moderation_case();

-- Backfill déterministe : les anciens signalements reçoivent chacun un dossier.
insert into public.moderation_cases (report_id, subject_id, category)
select r.id, coalesce(v.author_id, p.author_id, c.author_id), r.category
from public.reports r left join public.videos v on v.id = r.video_id
left join public.posts p on p.id = r.post_id left join public.comments c on c.id = r.comment_id
where not exists (select 1 from public.moderation_cases mc where mc.report_id = r.id);

create or replace function private.is_mentorship_restricted(p_user_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public, private as $$
  select exists (select 1 from public.moderation_sanctions s
    where s.subject_id = p_user_id and s.kind = 'mentorship_restriction'
      and s.revoked_at is null and s.expires_at > now())
$$;

create or replace function private.triage_moderation_case(p_case_id uuid, p_status public.moderation_case_status, p_priority smallint) returns boolean
language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if p_status not in ('triaged', 'closed') or p_priority not between 0 and 2
     or not exists (select 1 from public.profiles where id = auth.uid() and role in ('moderateur', 'admin')) then return false; end if;
  update public.moderation_cases set status = p_status, priority = p_priority, triaged_by = auth.uid(), triaged_at = now() where id = p_case_id;
  if not found then return false; end if;
  insert into public.moderation_events (case_id, actor_id, action, after_state)
    values (p_case_id, auth.uid(), 'case_triaged', jsonb_build_object('status', p_status, 'priority', p_priority));
  return true;
end $$;

create or replace function private.issue_moderation_sanction(p_case_id uuid, p_kind public.moderation_sanction_kind, p_days integer, p_reason public.report_category) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_subject uuid; v_id uuid; v_issued timestamptz := now();
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     or (p_kind = 'warning' and p_days is not null)
     or (p_kind = 'mentorship_restriction' and p_days not in (7, 30)) then return null; end if;
  select subject_id into v_subject from public.moderation_cases where id = p_case_id;
  if v_subject is null then return null; end if;
  insert into public.moderation_sanctions (case_id, subject_id, issued_by, kind, reason, issued_at, expires_at)
  values (p_case_id, v_subject, auth.uid(), p_kind, p_reason, v_issued,
    case when p_kind = 'mentorship_restriction' then v_issued + make_interval(days => p_days) end) returning id into v_id;
  insert into public.moderation_events (case_id, sanction_id, actor_id, action, after_state)
  values (p_case_id, v_id, auth.uid(), 'sanction_issued', jsonb_build_object('kind', p_kind, 'days', p_days, 'reason', p_reason));
  return v_id;
end $$;

create or replace function private.submit_moderation_appeal(p_sanction_id uuid, p_statement text) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_id uuid;
begin
  if char_length(btrim(coalesce(p_statement, ''))) not between 20 and 2000 then return null; end if;
  insert into public.moderation_appeals (sanction_id, appellant_id, statement)
  select id, auth.uid(), btrim(p_statement) from public.moderation_sanctions
  where id = p_sanction_id and subject_id = auth.uid() and revoked_at is null and issued_at + interval '30 days' >= now()
  returning id into v_id;
  if v_id is not null then
    insert into public.moderation_events (sanction_id, appeal_id, actor_id, action) values (p_sanction_id, v_id, auth.uid(), 'appeal_submitted');
  end if;
  return v_id;
exception when unique_violation then return null;
end $$;

create or replace function private.review_moderation_appeal(p_appeal_id uuid, p_decision public.moderation_appeal_status, p_note text) returns boolean
language plpgsql security definer set search_path = pg_catalog, public, private as $$
declare v_sanction uuid; v_issuer uuid;
begin
  if p_decision not in ('upheld', 'overturned') or char_length(btrim(coalesce(p_note, ''))) not between 20 and 2000 or not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then return false; end if;
  select s.id, s.issued_by into v_sanction, v_issuer from public.moderation_appeals a join public.moderation_sanctions s on s.id = a.sanction_id
    where a.id = p_appeal_id and a.status = 'pending';
  if v_sanction is null or v_issuer = auth.uid() then return false; end if;
  update public.moderation_appeals set status = p_decision, decided_at = now(), decided_by = auth.uid(), decision_note = btrim(p_note) where id = p_appeal_id;
  if p_decision = 'overturned' then
    update public.moderation_sanctions set revoked_at = now(), revoked_by = auth.uid() where id = v_sanction and revoked_at is null;
    insert into public.moderation_events (sanction_id, appeal_id, actor_id, action) values (v_sanction, p_appeal_id, auth.uid(), 'sanction_revoked');
  end if;
  insert into public.moderation_events (sanction_id, appeal_id, actor_id, action) values (v_sanction, p_appeal_id, auth.uid(), 'appeal_' || p_decision::text);
  return true;
end $$;

-- Les seules RPC publiques sont INVOKER : l'élévation reste interne à private.
create or replace function public.triage_moderation_case(p_case_id uuid, p_status public.moderation_case_status, p_priority smallint default 0) returns boolean
language sql security invoker set search_path = pg_catalog, public, private as $$ select private.triage_moderation_case(p_case_id, p_status, p_priority) $$;
create or replace function public.issue_moderation_sanction(p_case_id uuid, p_kind public.moderation_sanction_kind, p_days integer default null, p_reason public.report_category default 'autre') returns uuid
language sql security invoker set search_path = pg_catalog, public, private as $$ select private.issue_moderation_sanction(p_case_id, p_kind, p_days, p_reason) $$;
create or replace function public.submit_moderation_appeal(p_sanction_id uuid, p_statement text) returns uuid
language sql security invoker set search_path = pg_catalog, public, private as $$ select private.submit_moderation_appeal(p_sanction_id, p_statement) $$;
create or replace function public.review_moderation_appeal(p_appeal_id uuid, p_decision public.moderation_appeal_status, p_note text) returns boolean
language sql security invoker set search_path = pg_catalog, public, private as $$ select private.review_moderation_appeal(p_appeal_id, p_decision, p_note) $$;
grant execute on function public.triage_moderation_case(uuid, public.moderation_case_status, smallint), public.issue_moderation_sanction(uuid, public.moderation_sanction_kind, integer, public.report_category), public.submit_moderation_appeal(uuid, text), public.review_moderation_appeal(uuid, public.moderation_appeal_status, text) to authenticated;
-- Les wrappers INVOKER ont besoin du droit interne ; `private` n'est pas un
-- schéma PostgREST exposé, donc aucune fonction DEFINER ne devient une RPC.
grant usage on schema private to authenticated;
grant execute on function private.triage_moderation_case(uuid, public.moderation_case_status, smallint), private.issue_moderation_sanction(uuid, public.moderation_sanction_kind, integer, public.report_category), private.submit_moderation_appeal(uuid, text), private.review_moderation_appeal(uuid, public.moderation_appeal_status, text), private.is_mentorship_restricted(uuid) to authenticated;
revoke execute on function private.create_moderation_case(), private.validate_report_target(), private.log_report_event(), private.log_video_moderation_event() from public, anon, authenticated;

-- Une restriction expire toute seule à la lecture : aucun cron ne la maintient.
drop policy if exists "s'offrir mentor" on public.mentor_offers;
create policy "s'offrir mentor" on public.mentor_offers for insert to authenticated with check (user_id = auth.uid() and not private.is_mentorship_restricted(auth.uid()));
drop policy if exists "mettre à jour son offre mentor" on public.mentor_offers;
create policy "mettre à jour son offre mentor" on public.mentor_offers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and not private.is_mentorship_restricted(auth.uid()));
drop policy if exists "proposer mentorat" on public.mentorships;
create policy "proposer mentorat" on public.mentorships for insert to authenticated with check ((mentor_id = auth.uid() or mentee_id = auth.uid()) and not private.is_mentorship_restricted(auth.uid()));
