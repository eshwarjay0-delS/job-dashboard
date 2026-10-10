-- MFit Agent: notifications + watchdog dedup state
create table if not exists public.mfit_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'watchdog',
  title text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mfit_notifications_user_idx on public.mfit_notifications (user_id, created_at desc);

create table if not exists public.mfit_watchdog_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  check_type text not null,
  role_key text not null,
  vendor_hash text not null,
  notified_at timestamptz not null default now(),
  unique (user_id, check_type, role_key, vendor_hash)
);

alter table public.mfit_notifications enable row level security;
alter table public.mfit_watchdog_state enable row level security;

drop policy if exists "own notifications" on public.mfit_notifications;
create policy "own notifications" on public.mfit_notifications
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
