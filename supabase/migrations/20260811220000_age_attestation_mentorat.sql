-- ADR-0011 — Attestation explicite 18+ sans date de naissance, document ni âge numérique.
-- Les comptes historiques restent membres mais ne sont pas rétroactivement attestés.

create table public.age_attestations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  policy_version text not null check (policy_version = '2026-08-11-v1'),
  attested_at timestamptz not null default now()
);
alter table public.age_attestations enable row level security;
revoke all on public.age_attestations from anon, authenticated;
grant select on public.age_attestations to authenticated;
create policy "lire sa propre attestation" on public.age_attestations
  for select to authenticated using (user_id = auth.uid());

-- Ce helper ne renvoie jamais de donnée d'attestation : il sert aux policies.
create or replace function private.is_age_attested(p_user_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public, private as $$
  select exists (
    select 1 from public.age_attestations a
    where a.user_id = p_user_id and a.policy_version = '2026-08-11-v1'
  )
$$;

create or replace function private.is_mentorship_eligible(p_user_id uuid) returns boolean
language sql stable security definer set search_path = pg_catalog, public, private as $$
  select private.is_age_attested(p_user_id)
    and not private.is_mentorship_restricted(p_user_id)
$$;

-- La voie d'attestation ne reçoit aucune date, âge, version ni identité du client.
create or replace function private.attest_age_18() returns boolean
language plpgsql security definer set search_path = pg_catalog, public, private as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    return false;
  end if;
  insert into public.age_attestations (user_id, policy_version)
  values (auth.uid(), '2026-08-11-v1')
  on conflict (user_id) do nothing;
  return true;
end;
$$;

create or replace function public.attest_age_18() returns boolean
language sql security invoker set search_path = pg_catalog, public, private as $$
  select private.attest_age_18()
$$;

revoke all on function private.is_age_attested(uuid), private.is_mentorship_eligible(uuid), private.attest_age_18() from public, anon;
grant execute on function private.is_age_attested(uuid), private.is_mentorship_eligible(uuid), private.attest_age_18() to authenticated;
revoke all on function public.attest_age_18() from public, anon;
grant execute on function public.attest_age_18() to authenticated;

-- Le trigger Auth ne crée une attestation qu'après la case explicite à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text := coalesce(nullif(new.raw_user_meta_data->>'username',''), 'membre_' || substr(new.id::text, 1, 8));
  affiche text := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), wanted);
  ctry char(2) := upper(coalesce(nullif(new.raw_user_meta_data->>'country',''), 'FR'));
  loc text := nullif(new.raw_user_meta_data->>'locale','');
begin
  if loc is not null and loc not in ('fr','en','es','pt','it','de','ru','ar','he','zh','ja','ko') then
    loc := null;
  end if;
  begin
    insert into public.profiles (id, username, display_name, country, lang, locale)
    values (new.id, wanted, affiche, ctry, coalesce(loc, 'fr'), loc);
  exception when unique_violation then
    insert into public.profiles (id, username, display_name, country, lang, locale)
    values (new.id, wanted || '_' || substr(new.id::text, 1, 4), affiche, ctry, coalesce(loc, 'fr'), loc)
    on conflict (id) do nothing;
  end;
  if new.raw_user_meta_data -> 'age_attested' = 'true'::jsonb then
    insert into public.age_attestations (user_id, policy_version)
    values (new.id, '2026-08-11-v1')
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- L'attestation et l'absence de restriction sont des barrières SQL, pas UI.
drop policy if exists "offres lisibles" on public.mentor_offers;
drop policy if exists "s'offrir mentor" on public.mentor_offers;
drop policy if exists "mettre à jour son offre mentor" on public.mentor_offers;
drop policy if exists "retirer offre" on public.mentor_offers;
create policy "offres mentor attestées lisibles" on public.mentor_offers
  for select to authenticated using (
    private.is_mentorship_eligible(auth.uid())
    and private.is_mentorship_eligible(user_id)
  );
create policy "créer son offre mentor attestée" on public.mentor_offers
  for insert to authenticated with check (
    user_id = auth.uid() and private.is_mentorship_eligible(auth.uid())
  );
create policy "mettre à jour son offre mentor attestée" on public.mentor_offers
  for update to authenticated
  using (user_id = auth.uid() and private.is_mentorship_eligible(auth.uid()))
  with check (user_id = auth.uid() and private.is_mentorship_eligible(auth.uid()));
create policy "retirer sa propre offre mentor" on public.mentor_offers
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "voir ses mentorats" on public.mentorships;
drop policy if exists "proposer mentorat" on public.mentorships;
drop policy if exists "maj mentorat" on public.mentorships;
create policy "voir les mentorats attestés" on public.mentorships
  for select to authenticated using (
    private.is_mentorship_eligible(auth.uid())
    and private.is_mentorship_eligible(mentor_id)
    and private.is_mentorship_eligible(mentee_id)
  );
create policy "proposer un mentorat attesté" on public.mentorships
  for insert to authenticated with check (
    mentor_id <> mentee_id
    and (mentor_id = auth.uid() or mentee_id = auth.uid())
    and private.is_mentorship_eligible(mentor_id)
    and private.is_mentorship_eligible(mentee_id)
    and exists (select 1 from public.mentor_offers o where o.user_id = mentor_id)
  );
create policy "mettre à jour un mentorat attesté" on public.mentorships
  for update to authenticated
  using (
    (mentor_id = auth.uid() or mentee_id = auth.uid())
    and private.is_mentorship_eligible(auth.uid())
    and private.is_mentorship_eligible(mentor_id)
    and private.is_mentorship_eligible(mentee_id)
  )
  with check (
    (mentor_id = auth.uid() or mentee_id = auth.uid())
    and private.is_mentorship_eligible(auth.uid())
    and private.is_mentorship_eligible(mentor_id)
    and private.is_mentorship_eligible(mentee_id)
  );
