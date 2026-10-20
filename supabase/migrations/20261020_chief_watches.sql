-- Chief watch tasks: the briefable Chief's persistent goals.
-- A watch = a plain-words goal ("watch the Richmond 814050 req") decomposed
-- into sub-checks, run on a schedule, nudging only when something changes.
create table if not exists public.mfit_chief_watches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  goal text not null,
  subject text,
  sub_checks jsonb not null default '[]'::jsonb,
  check_every_minutes integer not null default 120,
  next_run_at timestamptz not null default now(),
  deadline_at timestamptz,
  status text not null default 'active',
  last_findings jsonb,
  last_findings_hash text,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mfit_chief_watches_user_idx on public.mfit_chief_watches (user_id, status, next_run_at);
