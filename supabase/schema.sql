-- ════════════════════════════════════════════════════════════════
-- CareerKit — multi-user schema (run once in Supabase → SQL Editor)
-- Model: Google sign-in + Bring-Your-Own Google Drive.
--   · Resume FILES live in each user's own Google Drive (zero storage cost).
--   · Supabase holds only tiny metadata + the per-user limits.
--   · Row-Level Security makes every row private to its owner — nobody
--     else (not even via the API) can read another user's data.
-- ════════════════════════════════════════════════════════════════

-- 1) PROFILE — one row per user (created on first sign-in by /auth/callback)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  tier        text not null default 'free',   -- 'free' | 'pro'
  created_at  timestamptz not null default now()
);

-- 2) DRIVE CONNECTION — the Google refresh token + the CareerKit folder id
create table if not exists public.user_drive (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token text,
  folder_id     text,                          -- the "CareerKit Resumes" folder in their Drive
  connected_at  timestamptz not null default now()
);

-- 3) RESUME METADATA — tiny pointer to each file in the user's Drive.
--    Counting these rows enforces the free-tier 78-resume cap.
create table if not exists public.resumes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  drive_file_id text not null,
  filename      text not null,
  category      text default '',
  size_bytes    bigint default 0,
  created_at    timestamptz not null default now()
);
create index if not exists resumes_user_idx on public.resumes(user_id);

-- 4) TAILOR LOG — one row per tailor run. Counting rows in the last 7 days
--    enforces the free-tier "7 tailors / week" limit (no reset job needed).
create table if not exists public.tailor_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists tailor_log_user_time_idx on public.tailor_log(user_id, created_at);

-- ── Row-Level Security: each user sees ONLY their own rows ──────────
alter table public.profiles   enable row level security;
alter table public.user_drive enable row level security;
alter table public.resumes    enable row level security;
alter table public.tailor_log enable row level security;

-- profiles (keyed by id)
create policy "own profile read"   on public.profiles   for select using (auth.uid() = id);
create policy "own profile write"  on public.profiles   for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles   for update using (auth.uid() = id);

-- user_drive / resumes / tailor_log (keyed by user_id)
create policy "own drive read"   on public.user_drive for select using (auth.uid() = user_id);
create policy "own drive write"  on public.user_drive for insert with check (auth.uid() = user_id);
create policy "own drive update" on public.user_drive for update using (auth.uid() = user_id);

create policy "own resumes read"   on public.resumes for select using (auth.uid() = user_id);
create policy "own resumes write"  on public.resumes for insert with check (auth.uid() = user_id);
create policy "own resumes delete" on public.resumes for delete using (auth.uid() = user_id);

create policy "own log read"  on public.tailor_log for select using (auth.uid() = user_id);
create policy "own log write" on public.tailor_log for insert with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════
-- 2026-07-09 — "ask once, reuse everywhere" onboarding questions
-- (competitive gap vs Tsenta — see /dashboard/settings). Run this
-- block once in the Supabase SQL Editor; it's additive and safe to
-- run even if some columns already exist.
-- NOTE: profiles already carries many more columns than the create
-- table above shows (phone, location, linkedin, github, portfolio,
-- title, bio, visa_status, work_auth, skills, remote_ok, relo_ok,
-- salary_min, salary_max, open_to_roles, job_types, profile_complete)
-- added directly via earlier ad-hoc migrations not captured here.
-- ════════════════════════════════════════════════════════════════
alter table public.profiles add column if not exists start_immediately boolean;
alter table public.profiles add column if not exists has_transportation boolean;
alter table public.profiles add column if not exists has_clearance boolean;
