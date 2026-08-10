-- 0012 — Limitation atomique par compte, partagée entre toutes les instances.
-- Une ligne par (acteur, surface) est conservée : le changement de fenêtre
-- réinitialise le compteur, sans produire un historique infini de buckets.

create table public.rate_limit_windows (
  actor_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (char_length(scope) between 1 and 64),
  window_started timestamptz not null,
  count integer not null check (count between 0 and 10000),
  primary key (actor_id, scope)
);
alter table public.rate_limit_windows enable row level security;
revoke all on public.rate_limit_windows from anon, authenticated;

create or replace function public.consume_rate_limit(p_scope text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  max_requests integer;
  window_seconds integer;
  bucket timestamptz;
  accepted_count integer;
begin
  if actor is null then
    return false;
  end if;

  case p_scope
    when 'post' then max_requests := 6; window_seconds := 60;
    when 'comment' then max_requests := 12; window_seconds := 60;
    when 'prayer_request' then max_requests := 6; window_seconds := 60;
    when 'prayer_action' then max_requests := 20; window_seconds := 60;
    when 'report' then max_requests := 6; window_seconds := 600;
    when 'translation' then max_requests := 12; window_seconds := 60;
    when 'video_publish' then max_requests := 6; window_seconds := 3600;
    when 'video_amen' then max_requests := 30; window_seconds := 60;
    when 'video_comment' then max_requests := 12; window_seconds := 60;
    when 'video_prayer' then max_requests := 20; window_seconds := 60;
    when 'follow' then max_requests := 20; window_seconds := 60;
    when 'room_create' then max_requests := 3; window_seconds := 3600;
    when 'room_message' then max_requests := 12; window_seconds := 60;
    when 'challenge_create' then max_requests := 3; window_seconds := 86400;
    else
      raise exception 'rate limit scope non autorisé';
  end case;

  bucket := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into public.rate_limit_windows (actor_id, scope, window_started, count)
  values (actor, p_scope, bucket, 1)
  on conflict (actor_id, scope) do update
    set window_started = excluded.window_started,
        count = case
          when public.rate_limit_windows.window_started < excluded.window_started then 1
          else public.rate_limit_windows.count + 1
        end
    where public.rate_limit_windows.window_started < excluded.window_started
       or public.rate_limit_windows.count < max_requests
  returning count into accepted_count;

  return found;
end $$;

revoke execute on function public.consume_rate_limit(text) from public, anon;
grant execute on function public.consume_rate_limit(text) to authenticated;

-- Les messages contournent les Server Actions via Realtime : la limite doit
-- donc vivre dans la même policy RLS que l'état "salle ouverte".
drop policy if exists "écrire dans une salle ouverte" on public.room_messages;
create policy "écrire dans une salle ouverte et limitée" on public.room_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.consume_rate_limit('room_message')
    and exists (
      select 1 from public.prayer_rooms r
      where r.id = room_id and r.closed_at is null
    )
  );
