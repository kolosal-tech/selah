-- 0010 — Contrat multilingue et mise à jour de disponibilité mentor.

create table if not exists public.video_translations (
  video_id uuid not null references public.videos(id) on delete cascade,
  lang text not null check (char_length(lang) between 2 and 10),
  caption text,
  verse_ref text,
  storage_path text,
  thumb_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (video_id, lang)
);
alter table public.video_translations enable row level security;
create policy "traductions vidéo lisibles" on public.video_translations
  for select to authenticated using (true);
create policy "modérateurs gèrent traductions vidéo" on public.video_translations
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('moderateur', 'admin')
    )
  );

create policy "mettre à jour son offre mentor" on public.mentor_offers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
