create table if not exists private.google_workspace_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_subject text not null,
  google_email text not null,
  granted_scopes text[] not null default '{}',
  refresh_token_ciphertext text not null,
  token_version integer not null default 1,
  gmail_enabled boolean not null default false,
  calendar_enabled boolean not null default false,
  is_primary boolean not null default false,
  last_gmail_sync_at timestamptz,
  last_calendar_sync_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, google_subject),
  unique (google_subject)
);

create index if not exists google_workspace_accounts_user_id_idx
  on private.google_workspace_accounts(user_id);
create index if not exists google_workspace_accounts_user_active_idx
  on private.google_workspace_accounts(user_id, revoked_at);
create unique index if not exists google_workspace_accounts_one_primary_idx
  on private.google_workspace_accounts(user_id)
  where is_primary = true and revoked_at is null;

alter table private.google_workspace_accounts enable row level security;
revoke all on private.google_workspace_accounts from public, anon, authenticated;

insert into private.google_workspace_accounts(
  user_id, google_subject, google_email, granted_scopes,
  refresh_token_ciphertext, token_version, gmail_enabled, calendar_enabled,
  is_primary, last_gmail_sync_at, last_calendar_sync_at, connected_at, updated_at
)
select
  g.user_id,
  coalesce(g.google_subject, 'legacy:' || g.user_id::text),
  g.google_email,
  g.granted_scopes,
  g.refresh_token_ciphertext,
  g.token_version,
  g.gmail_enabled,
  g.calendar_enabled,
  true,
  g.last_gmail_sync_at,
  g.last_calendar_sync_at,
  g.connected_at,
  g.updated_at
from private.google_workspace_connections g
where not exists (
  select 1 from private.google_workspace_accounts a where a.user_id = g.user_id
)
on conflict do nothing;

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
  v_count integer;
  v_primary boolean;
begin
  select user_id into v_owner
  from private.google_workspace_accounts
  where google_subject = p_google_subject and revoked_at is null
  limit 1;

  if v_owner is not null and v_owner <> p_user_id then
    raise exception 'This Google account is already connected to another MarketFit account.';
  end if;

  select count(*) into v_count
  from private.google_workspace_accounts
  where user_id = p_user_id and revoked_at is null;

  select coalesce(bool_or(is_primary), false) into v_primary
  from private.google_workspace_accounts
  where user_id = p_user_id and revoked_at is null;

  select id into v_id
  from private.google_workspace_accounts
  where user_id = p_user_id and google_subject = p_google_subject
  limit 1;

  if v_id is null and v_count >= 4 then
    raise exception 'You can connect up to 4 Google accounts.';
  end if;

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
  limit 4
$$;

create or replace function public.identity_get_google_workspace_account(
  p_user_id uuid,
  p_account_id uuid default null
)
returns table(
  id uuid,
  google_email text,
  granted_scopes text[],
  refresh_token_ciphertext text,
  gmail_enabled boolean,
  calendar_enabled boolean,
  is_primary boolean,
  last_gmail_sync_at timestamptz,
  last_calendar_sync_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select a.id,a.google_email,a.granted_scopes,a.refresh_token_ciphertext,
         a.gmail_enabled,a.calendar_enabled,a.is_primary,
         a.last_gmail_sync_at,a.last_calendar_sync_at
  from private.google_workspace_accounts a
  where a.user_id=p_user_id
    and a.revoked_at is null
    and (p_account_id is null or a.id=p_account_id)
  order by case when p_account_id is not null and a.id=p_account_id then 0
                when a.is_primary then 1 else 2 end,
           a.connected_at asc
  limit 1
$$;

create or replace function public.identity_set_primary_google_workspace_account(
  p_user_id uuid,
  p_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (
    select 1 from private.google_workspace_accounts
    where id=p_account_id and user_id=p_user_id and revoked_at is null
  ) then
    raise exception 'Google account not found.';
  end if;

  update private.google_workspace_accounts
  set is_primary=(id=p_account_id), updated_at=now()
  where user_id=p_user_id and revoked_at is null;
end;
$$;

create or replace function public.identity_disconnect_google_workspace_account(
  p_user_id uuid,
  p_account_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_was_primary boolean;
  v_next uuid;
begin
  select is_primary into v_was_primary
  from private.google_workspace_accounts
  where id=p_account_id and user_id=p_user_id and revoked_at is null;

  if v_was_primary is null then
    raise exception 'Google account not found.';
  end if;

  update private.google_workspace_accounts
  set revoked_at=now(), is_primary=false, updated_at=now()
  where id=p_account_id and user_id=p_user_id;

  if v_was_primary then
    select id into v_next
    from private.google_workspace_accounts
    where user_id=p_user_id and revoked_at is null
    order by connected_at asc
    limit 1;
    if v_next is not null then
      update private.google_workspace_accounts
      set is_primary=true, updated_at=now()
      where id=v_next;
    end if;
  end if;

  update public.profiles
  set gmail_connected = exists (
        select 1 from private.google_workspace_accounts
        where user_id=p_user_id and revoked_at is null and gmail_enabled
      ),
      calendar_connected = exists (
        select 1 from private.google_workspace_accounts
        where user_id=p_user_id and revoked_at is null and calendar_enabled
      ),
      updated_at=now()
  where id=p_user_id;

  insert into public.identity_audit(user_id,actor_user_id,event_type,channel,details)
  values (p_user_id,p_user_id,'google_workspace_account_disconnected','system',
          jsonb_build_object('account_id',p_account_id));
end;
$$;

revoke all on function public.identity_attach_google_workspace_account(uuid,text,text,text[],text,boolean,boolean) from public,anon,authenticated;
revoke all on function public.identity_list_google_workspace_accounts(uuid) from public,anon,authenticated;
revoke all on function public.identity_get_google_workspace_account(uuid,uuid) from public,anon,authenticated;
revoke all on function public.identity_set_primary_google_workspace_account(uuid,uuid) from public,anon,authenticated;
revoke all on function public.identity_disconnect_google_workspace_account(uuid,uuid) from public,anon,authenticated;

grant execute on function public.identity_attach_google_workspace_account(uuid,text,text,text[],text,boolean,boolean) to service_role;
grant execute on function public.identity_list_google_workspace_accounts(uuid) to service_role;
grant execute on function public.identity_get_google_workspace_account(uuid,uuid) to service_role;
grant execute on function public.identity_set_primary_google_workspace_account(uuid,uuid) to service_role;
grant execute on function public.identity_disconnect_google_workspace_account(uuid,uuid) to service_role;
