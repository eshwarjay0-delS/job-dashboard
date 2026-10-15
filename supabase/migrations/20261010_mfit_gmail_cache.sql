-- MFit Gmail cache: load once, refresh incrementally. No more full re-downloads.
create table if not exists public.mfit_gmail_threads (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  thread_id text not null,
  account_email text not null default '',
  latest_ts bigint not null default 0,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, account_id, thread_id)
);
create index if not exists mfit_gmail_threads_user_idx
  on public.mfit_gmail_threads (user_id, latest_ts desc);

create table if not exists public.mfit_gmail_sync (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  last_sync_at timestamptz,
  days_synced int not null default 30,
  primary key (user_id, account_id)
);

alter table public.mfit_gmail_threads enable row level security;
alter table public.mfit_gmail_sync enable row level security;

drop policy if exists "own gmail cache" on public.mfit_gmail_threads;
create policy "own gmail cache" on public.mfit_gmail_threads
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own gmail sync" on public.mfit_gmail_sync;
create policy "own gmail sync" on public.mfit_gmail_sync
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
