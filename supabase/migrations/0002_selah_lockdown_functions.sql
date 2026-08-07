-- Verrouillage des fonctions : triggers non appelables en RPC,
-- touch_streak limité à l'utilisateur courant (auth.uid()).

revoke execute on function public.bump_amen() from public, anon, authenticated;
revoke execute on function public.bump_comment() from public, anon, authenticated;
revoke execute on function public.bump_pray() from public, anon, authenticated;

drop function public.touch_streak(uuid);

create or replace function public.touch_streak() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
declare last_day date;
begin
  if uid is null then return; end if;
  select streak_last_day into last_day from profiles where id = uid;
  if last_day = current_date then return;
  elsif last_day = current_date - 1 then
    update profiles set streak_days = streak_days + 1, streak_last_day = current_date where id = uid;
  else
    update profiles set streak_days = 1, streak_last_day = current_date where id = uid;
  end if;
end $$;

revoke execute on function public.touch_streak() from public, anon;
grant execute on function public.touch_streak() to authenticated;
