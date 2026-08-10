-- Migration historique récupérée du catalogue de production.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wanted text := coalesce(nullif(new.raw_user_meta_data->>'username',''),
                          'membre_' || substr(new.id::text, 1, 8));
  affiche text := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), wanted);
  ctry char(2) := upper(coalesce(nullif(new.raw_user_meta_data->>'country',''), 'FR'));
  loc text := nullif(new.raw_user_meta_data->>'locale','');
begin
  if loc is not null and loc not in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko') then
    loc := null;
  end if;
  begin
    insert into public.profiles (id, username, display_name, country, locale)
    values (new.id, wanted, affiche, ctry, loc);
  exception when unique_violation then
    insert into public.profiles (id, username, display_name, country, locale)
    values (new.id, wanted || '_' || substr(new.id::text, 1, 4), affiche, ctry, loc)
    on conflict (id) do nothing;
  end;
  return new;
end $function$;
