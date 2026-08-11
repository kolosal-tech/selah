-- Correctif d'advisor : `public.record_anonymous_event` était SECURITY DEFINER
-- dans le schéma exposé par PostgREST, ce que les advisors 0028 et 0029
-- signalent — à raison, puisqu'une fonction élevée y est appelable sans
-- session.
--
-- Le motif correct est déjà celui de `consume_rate_limit` : le wrapper public
-- reste SECURITY INVOKER, et c'est l'implémentation, qui vit dans le schéma
-- `private` non exposé, qui porte l'élévation. La sécurité est inchangée —
-- l'appel reste refusé sans le jeton — mais plus aucune fonction élevée n'est
-- joignable directement depuis l'API REST.

create or replace function public.record_anonymous_event(
  p_token text,
  p_name text,
  p_surface text,
  p_metric text default null,
  p_bucket text default null
) returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.record_anonymous_event_impl(p_token, p_name, p_surface, p_metric, p_bucket);
$$;

revoke all on function public.record_anonymous_event(text, text, text, text, text) from public;
grant execute on function public.record_anonymous_event(text, text, text, text, text)
  to anon, authenticated;

-- Le wrapper étant désormais INVOKER, l'appelant doit pouvoir exécuter
-- l'implémentation. Le schéma `private` n'est pas exposé par PostgREST : ce
-- droit ne crée aucun point d'entrée REST supplémentaire.
grant usage on schema private to anon;
grant execute on function private.record_anonymous_event_impl(text, text, text, text, text)
  to anon, authenticated;
