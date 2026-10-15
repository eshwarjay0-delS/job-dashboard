-- ── Gmail dashboard tables ────────────────────────────────────────────────
-- Stores normalized Gmail messages, ML-style keyword classifications,
-- and the user's unfollowed company/domain list.
-- Created 2026-10-08 for the MarketFit email command center.

-- ── gmail_emails ────────────────────────────────────────────────────────────
create table if not exists public.gmail_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id text not null,
  thread_id text not null,
  account_email text not null,
  from_addr text not null default '',
  to_addr text not null default '',
  subject text not null default '',
  snippet text not null default '',
  body_text text not null default '',
  email_date timestamptz,
  labels text[] not null default '{}',
  synced_at timestamptz not null default now(),
  unique (user_id, message_id)
);

create index if not exists gmail_emails_user_thread_idx
  on public.gmail_emails(user_id, thread_id);
create index if not exists gmail_emails_user_date_idx
  on public.gmail_emails(user_id, email_date desc);
create index if not exists gmail_emails_user_account_idx
  on public.gmail_emails(user_id, account_email);

alter table public.gmail_emails enable row level security;

drop policy if exists gmail_emails_owner on public.gmail_emails;
create policy gmail_emails_owner on public.gmail_emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── email_classifications ───────────────────────────────────────────────────
create table if not exists public.email_classifications (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.gmail_emails(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  confidence text not null default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  job_title text not null default '',
  rate text not null default '',
  client text not null default '',
  vendor text not null default '',
  vendor_domain text not null default '',
  classified_at timestamptz not null default now(),
  unique (email_id)
);

create index if not exists email_classifications_user_cat_idx
  on public.email_classifications(user_id, category);

alter table public.email_classifications enable row level security;

drop policy if exists email_classifications_owner on public.email_classifications;
create policy email_classifications_owner on public.email_classifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── unfollowed_domains ──────────────────────────────────────────────────────
-- Companies/domains the user has unfollowed: excluded from follow-up targets,
-- Quickies, and call lists everywhere. Marketing firms are pre-seeded.
create table if not exists public.unfollowed_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  company_name text not null default '',
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, domain)
);

alter table public.unfollowed_domains enable row level security;

drop policy if exists unfollowed_domains_owner on public.unfollowed_domains;
create policy unfollowed_domains_owner on public.unfollowed_domains
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── followup_state ──────────────────────────────────────────────────────────
-- Tracks follow-up automation state per thread: last action, next due, stage.
create table if not exists public.followup_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id text not null,
  account_email text not null default '',
  stage text not null default 'new'
    check (stage in ('new','followed_up','escalated_call','no_response','closed')),
  last_activity_at timestamptz,
  last_followup_at timestamptz,
  next_followup_due_at timestamptz,
  followup_count integer not null default 0,
  has_interview boolean not null default false,
  vendor text not null default '',
  vendor_domain text not null default '',
  job_title text not null default '',
  updated_at timestamptz not null default now(),
  unique (user_id, thread_id)
);

create index if not exists followup_state_user_due_idx
  on public.followup_state(user_id, next_followup_due_at);

alter table public.followup_state enable row level security;

drop policy if exists followup_state_owner on public.followup_state;
create policy followup_state_owner on public.followup_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
