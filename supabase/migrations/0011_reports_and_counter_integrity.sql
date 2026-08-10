-- 0011 — Intégrité des signalements et compteurs de commentaires texte.

alter table public.reports
  add constraint reports_exactly_one_target
  check (num_nonnulls(post_id, comment_id, video_id) = 1) not valid;
alter table public.reports
  add constraint reports_reason_length
  check (char_length(btrim(reason)) between 3 and 500) not valid;

create index if not exists reports_open_queue_idx
  on public.reports (status, created_at desc);
create unique index if not exists reports_unique_post_per_reporter
  on public.reports (reporter_id, post_id)
  where post_id is not null;
create unique index if not exists reports_unique_comment_per_reporter
  on public.reports (reporter_id, comment_id)
  where comment_id is not null;
create unique index if not exists reports_unique_video_per_reporter
  on public.reports (reporter_id, video_id)
  where video_id is not null;

create or replace function public.bump_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  end if;
  update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  return old;
end $$;

drop trigger if exists comment_counter on public.comments;
create trigger comment_counter after insert or delete on public.comments
  for each row execute function public.bump_comment();

revoke execute on function public.bump_comment() from public, anon, authenticated;
