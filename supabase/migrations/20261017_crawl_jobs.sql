-- Crawl jobs: centralized contract-job listings spidered from prime vendor portals.
-- Run in the Mfit project's SQL editor (us-east-1). Shared/global data (no user_id):
-- reads are public to signed-in app users; writes go through the service role only.

create table if not exists public.mfit_crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  portal text not null,                 -- adapter key, e.g. 'beaconhill'
  firm text not null,                   -- display name, e.g. 'Beacon Hill Technologies'
  title text not null,
  location text,
  work_type text not null default 'unknown',  -- 'contract' | 'permanent' | 'unknown'
  engagement text,                      -- raw employment-type string from the portal
  pay_range text,
  posted_at date,
  url text not null,
  description text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active boolean not null default true,
  unique (portal, url)
);
create index if not exists mfit_crawl_jobs_active_idx on public.mfit_crawl_jobs (active, work_type);
create index if not exists mfit_crawl_jobs_search_idx on public.mfit_crawl_jobs
  using gin (to_tsvector('english', title || ' ' || coalesce(location, '') || ' ' || coalesce(description, '')));

create table if not exists public.mfit_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  portals text[] not null default '{}',
  jobs_found int not null default 0,
  jobs_upserted int not null default 0,
  errors jsonb not null default '[]'::jsonb
);

alter table public.mfit_crawl_jobs enable row level security;
alter table public.mfit_crawl_runs enable row level security;

drop policy if exists "crawl jobs readable" on public.mfit_crawl_jobs;
create policy "crawl jobs readable" on public.mfit_crawl_jobs
  for select to authenticated using (true);

drop policy if exists "crawl runs readable" on public.mfit_crawl_runs;
create policy "crawl runs readable" on public.mfit_crawl_runs
  for select to authenticated using (true);

-- No insert/update/delete policies: writes happen with the service role (bypasses RLS).
