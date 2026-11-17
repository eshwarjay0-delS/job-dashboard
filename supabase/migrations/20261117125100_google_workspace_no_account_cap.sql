-- Owner correction (17 Nov 2026): 3–4 connected accounts is a target range, not a product cap.
-- Replace only the two RPCs that enforced the historical four-account ceiling.
-- Per-user ownership, globally unique Google subject, service-role-only execution and audit writes stay intact.

create or replace function public.identity_attach_google_workspace_account(
  p_user_id uuid,
  p_google_subject text,
  p_google_email text,
  p_scopes text[],
  p_refresh_token_ciphertext text,
  p_gmail_enabled boolean,
  p_calendar_enabled boolean
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_id uuid;
  v_owner uuid;
  v_primary boolean;
begin
  select user_id into v_owner
  from private.google_workspace_accounts
  where google_subject = p_google_subject and revoked_at is null
  limit 1;

  if v_owner is not null and v_owner <> p_user_id then
    raise exception 'This Google account is already connected to another MarketFit account.';
  end if;

  select coalesce(bool_or(is_primary), false) into v_primary
  from private.google_workspace_accounts
  where user_id = p_user_id and revoked_at is null;

  select id into v_id
  from private.google_workspace_accounts
  where user_id = p_user_id and google_subject = p_google_subject
  limit 1;

  insert into private.google_workspace_accounts(
    user_id, google_subject, google_email, granted_scopes,
    refresh_token_ciphertext, gmail_enabled, calendar_enabled,
    is_primary, revoked_at, connected_at, updated_at
  )
  values (
    p_user_id, p_google_subject, lower(p_google_email), coalesce(p_scopes,'{}'::text[]),
    p_refresh_token_ciphertext, p_gmail_enabled, p_calendar_enabled,
    not v_primary, null, now(), now()
  )
  on conflict (user_id, google_subject) do update set
    google_email = excluded.google_email,
    granted_scopes = excluded.granted_scopes,
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    token_version = private.google_workspace_accounts.token_version + 1,
    gmail_enabled = excluded.gmail_enabled,
    calendar_enabled = excluded.calendar_enabled,
    revoked_at = null,
    updated_at = now()
  returning id into v_id;

  update public.profiles
  set gmail_connected = exists (
        select 1 from private.google_workspace_accounts
        where user_id=p_user_id and revoked_at is null and gmail_enabled
      ),
      calendar_connected = exists (
        select 1 from private.google_workspace_accounts
        where user_id=p_user_id and revoked_at is null and calendar_enabled
      ),
      updated_at = now()
  where id = p_user_id;

  insert into public.connected_services(user_id, service, status, connected_account_label, connected_at, updated_at)
  values
    (
      p_user_id, 'gmail', 'connected',
      (select case when count(*)=1 then max(google_email) else count(*)::text || ' Google accounts' end
       from private.google_workspace_accounts
       where user_id=p_user_id and revoked_at is null and gmail_enabled),
      now(), now()
    ),
    (
      p_user_id, 'google_calendar',
      case when exists(select 1 from private.google_workspace_accounts where user_id=p_user_id and revoked_at is null and calendar_enabled)
           then 'connected' else 'disconnected' end,
      (select case when count(*)=1 then max(google_email) else count(*)::text || ' Google accounts' end
       from private.google_workspace_accounts
       where user_id=p_user_id and revoked_at is null and calendar_enabled),
      case when exists(select 1 from private.google_workspace_accounts where user_id=p_user_id and revoked_at is null and calendar_enabled)
           then now() else null end,
      now()
    )
  on conflict (user_id, service) do update set
    status = excluded.status,
    connected_account_label = excluded.connected_account_label,
    connected_at = excluded.connected_at,
    updated_at = now();

  insert into public.identity_audit(user_id, actor_user_id, event_type, channel, details)
  values (
    p_user_id,p_user_id,'google_workspace_account_connected','system',
    jsonb_build_object(
      'google_email',lower(p_google_email),
      'account_id',v_id,
      'gmail_enabled',p_gmail_enabled,
      'calendar_enabled',p_calendar_enabled
    )
  );

  return v_id;
end;
$$;

create or replace function public.identity_list_google_workspace_accounts(p_user_id uuid)
returns table(
  id uuid,
  google_email text,
  granted_scopes text[],
  gmail_enabled boolean,
  calendar_enabled boolean,
  is_primary boolean,
  last_gmail_sync_at timestamptz,
  last_calendar_sync_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select a.id,a.google_email,a.granted_scopes,a.gmail_enabled,a.calendar_enabled,
         a.is_primary,a.last_gmail_sync_at,a.last_calendar_sync_at,a.connected_at,a.updated_at
  from private.google_workspace_accounts a
  where a.user_id=p_user_id and a.revoked_at is null
  order by a.is_primary desc, a.connected_at asc
$$;

revoke all on function public.identity_attach_google_workspace_account(uuid,text,text,text[],text,boolean,boolean) from public,anon,authenticated;
revoke all on function public.identity_list_google_workspace_accounts(uuid) from public,anon,authenticated;
grant execute on function public.identity_attach_google_workspace_account(uuid,text,text,text[],text,boolean,boolean) to service_role;
grant execute on function public.identity_list_google_workspace_accounts(uuid) to service_role;
