-- Migration historique récupérée du catalogue de production.
alter table public.profiles
  add column if not exists locale text
  check (locale in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  wanted text := coalesce(nullif(new.raw_user_meta_data->>'username',''), 'membre_' || substr(new.id::text, 1, 8));
  ctry char(2) := upper(coalesce(nullif(new.raw_user_meta_data->>'country',''), 'FR'));
  loc text := nullif(new.raw_user_meta_data->>'locale','');
begin
  if loc is not null and loc not in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko') then
    loc := null;
  end if;
  begin
    insert into public.profiles (id, username, display_name, country, locale)
    values (new.id, wanted, wanted, ctry, loc);
  exception when unique_violation then
    insert into public.profiles (id, username, display_name, country, locale)
    values (new.id, wanted || '_' || substr(new.id::text, 1, 4), wanted, ctry, loc)
    on conflict (id) do nothing;
  end;
  return new;
end $function$;

create table if not exists public.video_translations (
  video_id uuid not null references public.videos(id) on delete cascade,
  lang text not null check (lang in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko')),
  caption text,
  verse_ref text,
  verse_text text,
  storage_path text,
  thumb_path text,
  created_at timestamptz not null default now(),
  primary key (video_id, lang)
);

alter table public.video_translations enable row level security;

create policy "traductions lecture publique"
  on public.video_translations for select
  to public
  using (true);

create policy "traductions ecriture par auteur"
  on public.video_translations for insert
  to authenticated
  with check (exists (
    select 1 from public.videos v
    where v.id = video_id and v.author_id = auth.uid()
  ));

create policy "traductions maj par auteur"
  on public.video_translations for update
  to authenticated
  using (exists (
    select 1 from public.videos v
    where v.id = video_id and v.author_id = auth.uid()
  ));
