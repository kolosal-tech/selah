-- 0013 — Inventaire réservé à la modération pour réconcilier Storage et DB.
-- Ces vues ne suppriment rien : une purge doit rester une décision opérée et
-- journalisée après vérification humaine.

create or replace view public.video_storage_orphans
with (security_barrier = true) as
select
  o.id as object_id,
  o.name as storage_path,
  o.created_at
from storage.objects o
where o.bucket_id = 'videos'
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderateur', 'admin')
  )
  and not exists (
    select 1 from public.videos v
    where v.storage_path = o.name or v.thumb_path = o.name
  )
  and not exists (
    select 1 from public.video_translations t
    where t.storage_path = o.name or t.thumb_path = o.name
  );

create or replace view public.video_storage_missing
with (security_barrier = true) as
select
  'video'::text as source,
  v.id as video_id,
  v.storage_path as expected_path
from public.videos v
where exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role in ('moderateur', 'admin')
)
and not exists (
  select 1 from storage.objects o
  where o.bucket_id = 'videos' and o.name = v.storage_path
)
union all
select
  'thumbnail'::text as source,
  v.id as video_id,
  v.thumb_path as expected_path
from public.videos v
where v.thumb_path is not null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderateur', 'admin')
  )
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'videos' and o.name = v.thumb_path
  )
union all
select
  'translation'::text as source,
  t.video_id,
  t.storage_path as expected_path
from public.video_translations t
where t.storage_path is not null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderateur', 'admin')
  )
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'videos' and o.name = t.storage_path
  )
union all
select
  'translation_thumbnail'::text as source,
  t.video_id,
  t.thumb_path as expected_path
from public.video_translations t
where t.thumb_path is not null
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('moderateur', 'admin')
  )
  and not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'videos' and o.name = t.thumb_path
  );

revoke all on public.video_storage_orphans, public.video_storage_missing from anon;
grant select on public.video_storage_orphans, public.video_storage_missing to authenticated;
