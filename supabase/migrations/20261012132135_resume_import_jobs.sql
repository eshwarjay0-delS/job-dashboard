-- Service-only, expiring capabilities for importing a previously reviewed archive.
create table if not exists public.resume_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  payload jsonb not null default '[]'::jsonb,
  result jsonb,
  expires_at timestamptz not null default now() + interval '1 hour',
  created_at timestamptz not null default now()
);
alter table public.resume_import_jobs enable row level security;
revoke all on public.resume_import_jobs from public, anon, authenticated;
grant all on public.resume_import_jobs to service_role;
-- The previous expression required backslashes in email addresses.
alter table public.resume_email_libraries drop constraint if exists resume_email_libraries_email_check;
alter table public.resume_email_libraries add constraint resume_email_libraries_email_check
  check(email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');
