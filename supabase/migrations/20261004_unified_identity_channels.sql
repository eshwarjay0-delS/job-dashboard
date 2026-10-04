-- Unified MarketFit identity/control-plane foundation.
-- Safe/additive: Google auth identity, one verified phone/WhatsApp binding,
-- optional Google Workspace connection, shared subscription usage, and two-device slots.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.admin_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','support','billing','analyst')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_memberships enable row level security;
drop policy if exists "admin_memberships_self_read" on public.admin_memberships;
create policy "admin_memberships_self_read" on public.admin_memberships
for select using ((select auth.uid()) = user_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  whatsapp text,
  phone_last4 text,
  phone_verified boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  gmail_connected boolean not null default false,
  calendar_connected boolean not null default false,
  location text,
  linkedin text,
  github text,
  portfolio text,
  title text,
  bio text,
  visa_status text,
  work_auth text,
  skills text[],
  remote_ok boolean,
  relo_ok boolean,
  start_immediately boolean,
  has_transportation boolean,
  has_clearance boolean,
  salary_min numeric,
  salary_max numeric,
  open_to_roles text[],
  job_types text[],
  profile_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_email_lower_uidx on public.profiles(lower(email)) where email is not null;
alter table public.profiles enable row level security;
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles for select using ((select auth.uid()) = id);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table if not exists public.connected_services (
  user_id uuid not null references auth.users(id) on delete cascade,
  service text not null check (service in ('gmail','google_calendar','whatsapp','extension')),
  status text not null default 'disconnected' check (status in ('disconnected','pending','connected','error','revoked')),
  connected_account_label text,
  connected_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, service)
);
alter table public.connected_services enable row level security;
drop policy if exists "connected_services_self_read" on public.connected_services;
create policy "connected_services_self_read" on public.connected_services for select using ((select auth.uid()) = user_id);

create table if not exists public.subscription_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_key text not null default 'free',
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  max_active_devices integer not null default 2 check (max_active_devices between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscription_accounts enable row level security;
drop policy if exists "subscription_accounts_self_read" on public.subscription_accounts;
create policy "subscription_accounts_self_read" on public.subscription_accounts for select using ((select auth.uid()) = user_id);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_channel text not null check (source_channel in ('web','mobile','extension','whatsapp','gmail','calendar','system')),
  feature_key text not null,
  source_event_key text,
  units numeric(14,4) not null default 1,
  estimated_cost_usd numeric(14,6),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists usage_events_source_event_uidx on public.usage_events(source_event_key) where source_event_key is not null;
create index if not exists usage_events_user_time_idx on public.usage_events(user_id, created_at desc);
alter table public.usage_events enable row level security;
drop policy if exists "usage_events_self_read" on public.usage_events;
create policy "usage_events_self_read" on public.usage_events for select using ((select auth.uid()) = user_id);

create table if not exists public.identity_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  channel text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists identity_audit_user_time_idx on public.identity_audit(user_id, created_at desc);
create index if not exists identity_audit_actor_user_idx on public.identity_audit(actor_user_id);
alter table public.identity_audit enable row level security;
drop policy if exists "identity_audit_self_read" on public.identity_audit;
create policy "identity_audit_self_read" on public.identity_audit for select using ((select auth.uid()) = user_id);

create table if not exists private.user_phone_bindings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text not null unique,
  phone_hash text not null unique,
  verified_at timestamptz not null,
  verification_provider text not null default 'twilio_verify',
  whatsapp_address text unique,
  whatsapp_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.user_phone_bindings enable row level security;
revoke all on private.user_phone_bindings from public, anon, authenticated;

create table if not exists private.google_workspace_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_subject text unique,
  google_email text not null,
  granted_scopes text[] not null default '{}',
  refresh_token_ciphertext text not null,
  token_version integer not null default 1,
  gmail_enabled boolean not null default false,
  calendar_enabled boolean not null default false,
  last_gmail_sync_at timestamptz,
  last_calendar_sync_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table private.google_workspace_connections enable row level security;
revoke all on private.google_workspace_connections from public, anon, authenticated;

create table if not exists private.device_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key_hash text not null,
  label text,
  status text not null default 'active' check (status in ('active','revoked')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_key_hash)
);
create index if not exists device_slots_user_status_idx on private.device_slots(user_id,status);
alter table private.device_slots enable row level security;
revoke all on private.device_slots from public, anon, authenticated;

create table if not exists private.device_channels (
  id uuid primary key default gen_random_uuid(),
  device_slot_id uuid not null references private.device_slots(id) on delete cascade,
  channel text not null check (channel in ('web','mobile','extension')),
  installation_key_hash text not null unique,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(device_slot_id,channel)
);
create index if not exists device_channels_slot_idx on private.device_channels(device_slot_id);
alter table private.device_channels enable row level security;
revoke all on private.device_channels from public, anon, authenticated;

create or replace function private.enforce_device_slot_limit()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $$
declare max_devices integer; active_count integer;
begin
  if new.status <> 'active' then return new; end if;
  select coalesce(max_active_devices,2) into max_devices from public.subscription_accounts where user_id=new.user_id;
  if max_devices is null then max_devices:=2; end if;
  select count(*) into active_count from private.device_slots
    where user_id=new.user_id and status='active' and (tg_op='INSERT' or id<>new.id);
  if active_count >= max_devices then raise exception 'DEVICE_LIMIT_REACHED'; end if;
  return new;
end $$;
revoke all on function private.enforce_device_slot_limit() from public,anon,authenticated;
drop trigger if exists trg_enforce_device_slot_limit on private.device_slots;
create trigger trg_enforce_device_slot_limit before insert or update of status,user_id
on private.device_slots for each row execute function private.enforce_device_slot_limit();

create or replace function private.bootstrap_marketfit_identity()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private as $$
begin
  insert into public.profiles(id,email,full_name,avatar_url)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name'),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set email=excluded.email,updated_at=now();
  insert into public.subscription_accounts(user_id,plan_key,status,max_active_devices)
  values(new.id,'free','active',2) on conflict(user_id) do nothing;
  insert into public.connected_services(user_id,service,status) values
    (new.id,'gmail','disconnected'),(new.id,'google_calendar','disconnected'),
    (new.id,'whatsapp','disconnected'),(new.id,'extension','disconnected')
  on conflict(user_id,service) do nothing;
  return new;
end $$;
revoke all on function private.bootstrap_marketfit_identity() from public,anon,authenticated;
drop trigger if exists trg_bootstrap_marketfit_identity on auth.users;
create trigger trg_bootstrap_marketfit_identity after insert or update of email,raw_user_meta_data
on auth.users for each row execute function private.bootstrap_marketfit_identity();

create or replace function public.identity_resolve_whatsapp_user(p_phone_e164 text)
returns uuid language sql stable security definer
set search_path=pg_catalog,public,private as $$
  select b.user_id from private.user_phone_bindings b
  join public.profiles p on p.id=b.user_id
  where b.phone_e164=p_phone_e164 and b.whatsapp_verified_at is not null
    and p.phone_verified and p.whatsapp_opt_in limit 1
$$;
revoke all on function public.identity_resolve_whatsapp_user(text) from public,anon,authenticated;
grant execute on function public.identity_resolve_whatsapp_user(text) to service_role;

create or replace function public.identity_get_google_workspace_connection(p_user_id uuid)
returns table(google_email text,granted_scopes text[],refresh_token_ciphertext text,gmail_enabled boolean,calendar_enabled boolean,last_gmail_sync_at timestamptz,last_calendar_sync_at timestamptz)
language sql stable security definer
set search_path=pg_catalog,public,private as $$
  select g.google_email,g.granted_scopes,g.refresh_token_ciphertext,g.gmail_enabled,g.calendar_enabled,g.last_gmail_sync_at,g.last_calendar_sync_at
  from private.google_workspace_connections g where g.user_id=p_user_id limit 1
$$;
revoke all on function public.identity_get_google_workspace_connection(uuid) from public,anon,authenticated;
grant execute on function public.identity_get_google_workspace_connection(uuid) to service_role;
