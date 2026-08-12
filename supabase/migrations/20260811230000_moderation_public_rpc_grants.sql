-- PostgreSQL accorde EXECUTE à PUBLIC par défaut lors d'un CREATE FUNCTION.
-- Les wrappers restaient protégés par leurs gardes internes, mais aucune RPC
-- de modération n'a de raison d'être visible pour une requête anonyme.

revoke all on function public.triage_moderation_case(uuid, public.moderation_case_status, smallint) from public, anon;
revoke all on function public.issue_moderation_sanction(uuid, public.moderation_sanction_kind, integer, public.report_category) from public, anon;
revoke all on function public.submit_moderation_appeal(uuid, text) from public, anon;
revoke all on function public.review_moderation_appeal(uuid, public.moderation_appeal_status, text) from public, anon;
grant execute on function public.triage_moderation_case(uuid, public.moderation_case_status, smallint) to authenticated;
grant execute on function public.issue_moderation_sanction(uuid, public.moderation_sanction_kind, integer, public.report_category) to authenticated;
grant execute on function public.submit_moderation_appeal(uuid, text) to authenticated;
grant execute on function public.review_moderation_appeal(uuid, public.moderation_appeal_status, text) to authenticated;
