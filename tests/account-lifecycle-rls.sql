\set ON_ERROR_STOP on

insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000061', '{"username":"cycle61","display_name":"Cycle 61"}')
on conflict do nothing;
insert into public.profiles (id, username, display_name) values
  ('00000000-0000-0000-0000-000000000061', 'cycle61', 'Cycle 61')
on conflict do nothing;

-- Les relations ne sont pas modifiables directement par le navigateur.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000061', false);
select set_config('request.jwt.claims', '{"session_id":"00000000-0000-0000-0000-000000000062"}', false);
do $$
declare refus integer := 0;
begin
  begin insert into public.account_deletion_requests (user_id) values (auth.uid()); exception when insufficient_privilege then refus := refus + 1; end;
  begin select * from public.account_deletion_receipts; exception when insufficient_privilege then refus := refus + 1; end;
  begin insert into public.account_sessions (user_id, session_id, browser_family, device_type) values (auth.uid(), gen_random_uuid(), 'chrome', 'desktop'); exception when insufficient_privilege then refus := refus + 1; end;
  if refus <> 3 then raise exception 'tables cycle compte directement accessibles: %', refus; end if;
end $$;
select public.request_account_deletion();
do $$ begin
  if not exists (select 1 from public.account_deletion_requests where user_id = auth.uid() and execute_after >= requested_at + interval '14 days') then raise exception 'demande différée absente'; end if;
end $$;
select public.record_account_session('chrome', 'desktop');
do $$ begin
  if not exists (select 1 from public.account_sessions where user_id = auth.uid() and session_id = '00000000-0000-0000-0000-000000000062') then raise exception 'session grossière absente'; end if;
end $$;
select public.cancel_account_deletion();
do $$ begin
  if exists (select 1 from public.account_deletion_requests where user_id = auth.uid()) then raise exception 'annulation suppression absente'; end if;
end $$;
reset role;

-- Le rôle service réclame seulement les demandes échues et le reçu ne contient
-- aucun identifiant d'utilisateur. La suppression Auth cascade ses sessions.
insert into public.account_deletion_requests (user_id, execute_after) values
  ('00000000-0000-0000-0000-000000000061', now() - interval '1 minute');
set role service_role;
do $$ declare v_request uuid; begin
  select request_id into v_request from public.claim_due_account_deletions(1);
  if v_request is null then raise exception 'claim cron absent'; end if;
  if not public.finish_account_deletion(v_request, 0, 'deleted', null) then raise exception 'reçu cron absent'; end if;
end $$;
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-000000000061';
do $$ begin
  if exists (select 1 from public.account_sessions where user_id = '00000000-0000-0000-0000-000000000061') then raise exception 'sessions non supprimées'; end if;
  if exists (select 1 from public.account_deletion_receipts where to_jsonb(account_deletion_receipts)::text like '%00000000-0000-0000-0000-000000000061%') then raise exception 'reçu identifiant'; end if;
end $$;
