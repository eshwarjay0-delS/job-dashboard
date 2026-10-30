-- Per-account run transcripts and paused live state. Separate from session metadata
-- to avoid truncation and permit independent (immutable) transcript storage.
create table if not exists public.kompas_account_session_artifacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  artifact_key text not null check (length(artifact_key) between 1 and 220),
  payload jsonb not null,
  captured_at bigint not null default 0,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(user_id,session_id,artifact_key),
  foreign key (user_id,session_id) references public.kompas_account_sessions(user_id,session_id) on delete cascade,
  check (jsonb_typeof(payload) = 'object')
);
alter table public.kompas_account_session_artifacts enable row level security;
revoke all on public.kompas_account_session_artifacts from public, anon, authenticated;
grant select, insert, update, delete on public.kompas_account_session_artifacts to service_role;
create index if not exists kompas_artifact_updated_idx on public.kompas_account_session_artifacts(user_id,updated_at desc);
-- The server alone calls this. Preserve the newest paused snapshot. Transcript
-- records are immutable in identity; a more complete late save may replace
-- only a shorter record with the same stable transcript key.
create or replace function public.save_kompas_account_artifact(
  p_user_id uuid,p_session_id text,p_key text,p_payload jsonb,p_captured bigint
) returns boolean language plpgsql security definer set search_path='' as $$
declare
  v_count int;
begin
  if p_user_id is null or p_session_id !~ '^[A-Za-z0-9:_-]{1,128}$'
    or p_key !~ '^[A-Za-z0-9:_-]{1,220}$' or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text)>2000000 then raise exception 'Invalid artifact'; end if;
  if p_key <> (p_session_id || ':live') and p_key !~ ('^'||p_session_id||':tx:[0-9]+$') then raise exception 'Wrong session artifact'; end if;
  if not exists(select 1 from public.kompas_account_sessions
    where user_id=p_user_id and session_id=p_session_id and deleted_at is null) then raise exception 'Session not found'; end if;
  insert into public.kompas_account_session_artifacts(user_id,session_id,artifact_key,payload,captured_at)
  values(p_user_id,p_session_id,p_key,p_payload,p_captured)
  on conflict(user_id,session_id,artifact_key) do update
    set payload=excluded.payload,captured_at=excluded.captured_at,updated_at=clock_timestamp()
    where excluded.captured_at > public.kompas_account_session_artifacts.captured_at
       or (excluded.captured_at = public.kompas_account_session_artifacts.captured_at and
         jsonb_array_length(case when jsonb_typeof(excluded.payload->'log')='array' then excluded.payload->'log' else '[]'::jsonb end)
         > jsonb_array_length(case when jsonb_typeof(public.kompas_account_session_artifacts.payload->'log')='array'
           then public.kompas_account_session_artifacts.payload->'log' else '[]'::jsonb end));
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;
revoke all on function public.save_kompas_account_artifact(uuid,text,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.save_kompas_account_artifact(uuid,text,text,jsonb,bigint) to service_role;
