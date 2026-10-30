-- Account-scoped Kompas interview session catalog (never a global browser cache).
-- Tombstones prevent another offline device from resurrecting deleted sessions.
create table if not exists public.kompas_account_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null check (length(session_id) between 1 and 128 and session_id ~ '^[A-Za-z0-9:_-]+$'),
  payload jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  deleted_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, session_id),
  constraint kompas_session_payload_object check (jsonb_typeof(payload) = 'object')
);
create index if not exists kompas_account_sessions_order_idx on public.kompas_account_sessions (user_id, updated_at desc);
alter table public.kompas_account_sessions enable row level security;
revoke all on public.kompas_account_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.kompas_account_sessions to service_role;

-- Only the authenticated server route can call this service-only function.
-- Per-session row locks serialize concurrent updates. Applying field-level patches
-- rather than stale full snapshots preserves changes from other devices.
create or replace function public.merge_kompas_account_session(
  p_user_id uuid, p_session_id text, p_patch jsonb, p_delete boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.kompas_account_sessions%rowtype;
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_next jsonb;
  v_transcripts jsonb;
begin
  if p_user_id is null or p_session_id !~ '^[A-Za-z0-9:_-]{1,128}$'
    or jsonb_typeof(v_patch) <> 'object' or octet_length(v_patch::text) > 4000000
  then raise exception 'Invalid session operation'; end if;
  insert into public.kompas_account_sessions(user_id, session_id)
  values (p_user_id, p_session_id) on conflict do nothing;
  select * into strict v_row from public.kompas_account_sessions
    where user_id = p_user_id and session_id = p_session_id for update;
  if p_delete then
    if v_row.deleted_at is null then
      update public.kompas_account_sessions
        set deleted_at = clock_timestamp(), payload = '{}'::jsonb,
            revision = revision + 1, updated_at = clock_timestamp()
      where user_id = p_user_id and session_id = p_session_id
      returning * into v_row;
    end if;
  elsif v_row.deleted_at is null then
    -- End is terminal. A second tab's stale start/pause cannot undo it.
    if nullif(v_row.payload->>'endedAt', '') is not null and
       (not (v_patch ? 'endedAt') or nullif(v_patch->>'endedAt', '') is null) then
      v_patch := v_patch - 'runAt' - 'pausedAt' - 'endedAt' - 'endedBy';
    end if;
    v_next := v_row.payload || v_patch;
    if v_patch ? 'transcripts' then
      if jsonb_typeof(v_patch->'transcripts') <> 'array' then
        raise exception 'Invalid transcript metadata';
      end if;
      -- Union by stable key; prefer incoming record for the same key and
      -- never drop transcript entries added on another device.
      select coalesce(jsonb_agg(z.value order by z.ord), '[]'::jsonb)
      into v_transcripts from (
        select distinct on (item->>'key') item as value, ord
        from (
          select item, ord from jsonb_array_elements(
            case when jsonb_typeof(v_row.payload->'transcripts') = 'array'
              then v_row.payload->'transcripts' else '[]'::jsonb end
          ) with ordinality t(item,ord)
          union all
          select item, ord + 1000000 from jsonb_array_elements(v_patch->'transcripts')
             with ordinality t(item,ord)
        ) a
        where jsonb_typeof(item) = 'object' and length(coalesce(item->>'key','')) between 1 and 200
        order by item->>'key', ord desc
      ) z;
      v_next := jsonb_set(v_next, '{transcripts}', v_transcripts, true);
    end if;
    if v_next is distinct from v_row.payload then
      update public.kompas_account_sessions
        set payload = v_next, revision = revision + 1, updated_at = clock_timestamp()
        where user_id = p_user_id and session_id = p_session_id returning * into v_row;
    end if;
  end if;
  return jsonb_build_object(
    'id', v_row.session_id, 'session', case when v_row.deleted_at is null then v_row.payload else null end,
    'deleted', v_row.deleted_at is not null, 'revision', v_row.revision,
    'updatedAt', v_row.updated_at
  );
end
$$;
revoke all on function public.merge_kompas_account_session(uuid,text,jsonb,boolean)
  from public, anon, authenticated;
grant execute on function public.merge_kompas_account_session(uuid,text,jsonb,boolean) to service_role;
