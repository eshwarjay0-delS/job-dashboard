-- Realtime mobile session/event foundation.
-- Keeps transport state deterministic and user-scoped while Supabase Realtime
-- handles low-latency fan-out to authenticated clients.

create table if not exists public.realtime_mobile_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_slot_id uuid,
  client_instance_id text not null,
  platform text not null check (platform in ('android','ios','web')),
  app_version text,
  status text not null default 'active'
    check (status in ('active','background','offline','ended')),
  transport text not null default 'supabase_realtime'
    check (transport in ('supabase_realtime')),
  last_heartbeat_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_instance_id)
);

create index if not exists realtime_mobile_sessions_user_status_idx
  on public.realtime_mobile_sessions(user_id, status, updated_at desc);
create index if not exists realtime_mobile_sessions_expiry_idx
  on public.realtime_mobile_sessions(expires_at);

alter table public.realtime_mobile_sessions enable row level security;

drop policy if exists "realtime mobile sessions owner read" on public.realtime_mobile_sessions;
create policy "realtime mobile sessions owner read"
on public.realtime_mobile_sessions
for select to authenticated
using (user_id = auth.uid());

create table if not exists public.realtime_mobile_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.realtime_mobile_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id text,
  direction text not null
    check (direction in ('client_to_server','server_to_client','system')),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  acked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, client_event_id)
);

create index if not exists realtime_mobile_events_session_id_idx
  on public.realtime_mobile_events(session_id, id);
create index if not exists realtime_mobile_events_user_time_idx
  on public.realtime_mobile_events(user_id, created_at desc);
create index if not exists realtime_mobile_events_type_idx
  on public.realtime_mobile_events(user_id, event_type, created_at desc);

alter table public.realtime_mobile_events enable row level security;

drop policy if exists "realtime mobile events owner read" on public.realtime_mobile_events;
create policy "realtime mobile events owner read"
on public.realtime_mobile_events
for select to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'realtime_mobile_events'
  ) then
    alter publication supabase_realtime add table public.realtime_mobile_events;
  end if;
end $$;
