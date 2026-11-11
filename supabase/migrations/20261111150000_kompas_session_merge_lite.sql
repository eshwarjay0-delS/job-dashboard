-- Supabase egress cut (11 Nov 2026).
-- merge_kompas_account_session returns the whole merged session payload (up to ~3.8 MB) on every save,
-- and the route never used it. This wrapper strips the payload inside Postgres, so a save sends back only
-- the id, revision and timestamps. The original function is unchanged; the route falls back to it until
-- this migration is applied.
create or replace function public.merge_kompas_account_session_lite(
  p_user_id uuid, p_session_id text, p_patch jsonb, p_delete boolean default false
) returns jsonb language sql security definer set search_path = '' as $$
  select public.merge_kompas_account_session(p_user_id, p_session_id, p_patch, p_delete) - 'session';
$$;
revoke all on function public.merge_kompas_account_session_lite(uuid,text,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function public.merge_kompas_account_session_lite(uuid,text,jsonb,boolean) to service_role;
