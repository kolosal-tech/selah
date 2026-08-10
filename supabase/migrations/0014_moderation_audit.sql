-- 0014 — Conservation des signalements et journal de modération minimal.

-- Conserver le signalement si le contenu signalé est supprimé. Le contrôle
-- "exactement une cible" devient un contrôle d'insertion : une cible supprimée
-- ultérieurement peut légitimement laisser la référence à NULL.
alter table public.reports drop constraint if exists reports_exactly_one_target;
alter table public.reports
  add constraint reports_at_most_one_target
  check (num_nonnulls(post_id, comment_id, video_id) <= 1) not valid;

create or replace function public.validate_report_target() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' and num_nonnulls(new.post_id, new.comment_id, new.video_id) <> 1 then
    raise exception 'un signalement doit cibler exactement un élément';
  end if;
  if tg_op = 'UPDATE' and num_nonnulls(new.post_id, new.comment_id, new.video_id) > 1 then
    raise exception 'un signalement ne peut cibler qu’un élément';
  end if;
  return new;
end $$;

drop trigger if exists reports_target_guard on public.reports;
create trigger reports_target_guard before insert or update on public.reports
  for each row execute function public.validate_report_target();

alter table public.reports drop constraint if exists reports_post_id_fkey;
alter table public.reports
  add constraint reports_post_id_fkey foreign key (post_id)
  references public.posts(id) on delete set null;
alter table public.reports drop constraint if exists reports_comment_id_fkey;
alter table public.reports
  add constraint reports_comment_id_fkey foreign key (comment_id)
  references public.comments(id) on delete set null;
alter table public.reports drop constraint if exists reports_video_id_fkey;
alter table public.reports
  add constraint reports_video_id_fkey foreign key (video_id)
  references public.videos(id) on delete set null;

create table public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('report_created', 'report_status_changed', 'video_hidden_changed')),
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.moderation_events enable row level security;
revoke all on public.moderation_events from anon, authenticated;
grant select on public.moderation_events to authenticated;
create policy "modérateurs lisent le journal" on public.moderation_events for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  );

create or replace function public.log_report_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.moderation_events (report_id, actor_id, action, after_state)
    values (new.id, auth.uid(), 'report_created', jsonb_build_object('status', new.status));
  elsif old.status is distinct from new.status then
    insert into public.moderation_events (report_id, actor_id, action, before_state, after_state)
    values (
      new.id,
      auth.uid(),
      'report_status_changed',
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end $$;

drop trigger if exists reports_audit on public.reports;
create trigger reports_audit after insert or update on public.reports
  for each row execute function public.log_report_event();

create or replace function public.log_video_moderation_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.hidden is distinct from new.hidden then
    insert into public.moderation_events (video_id, actor_id, action, before_state, after_state)
    values (
      new.id,
      auth.uid(),
      'video_hidden_changed',
      jsonb_build_object('hidden', old.hidden),
      jsonb_build_object('hidden', new.hidden)
    );
  end if;
  return new;
end $$;

drop trigger if exists videos_moderation_audit on public.videos;
create trigger videos_moderation_audit after update on public.videos
  for each row execute function public.log_video_moderation_event();

revoke execute on function public.validate_report_target() from public, anon, authenticated;
revoke execute on function public.log_report_event() from public, anon, authenticated;
revoke execute on function public.log_video_moderation_event() from public, anon, authenticated;
