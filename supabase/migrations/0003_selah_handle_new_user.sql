-- Création automatique du profil à l'inscription (robuste avec ou sans
-- confirmation email). Username depuis les métadonnées, suffixe si collision.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wanted text := coalesce(nullif(new.raw_user_meta_data->>'username',''), 'membre_' || substr(new.id::text, 1, 8));
  ctry char(2) := upper(coalesce(nullif(new.raw_user_meta_data->>'country',''), 'FR'));
begin
  begin
    insert into public.profiles (id, username, display_name, country)
    values (new.id, wanted, wanted, ctry);
  exception when unique_violation then
    insert into public.profiles (id, username, display_name, country)
    values (new.id, wanted || '_' || substr(new.id::text, 1, 4), wanted, ctry)
    on conflict (id) do nothing;
  end;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
