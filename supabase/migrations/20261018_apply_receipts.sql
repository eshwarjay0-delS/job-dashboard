-- MarketFit apply receipts table
-- Stores submission receipts for every apply (Tsenta /trace borrow).
-- Run this in the Mfit Supabase SQL editor (us-east-1).

create table if not exists public.mfit_apply_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  job_title text,
  company text,
  portal_url text not null,
  ats_platform text,
  submitted_at timestamptz not null default now(),
  fields_filled jsonb not null default '[]'::jsonb,
  screenshot_url text,
  status text not null default 'submitted' check (status in ('submitted', 'review_pending', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

-- RLS: users see only their own receipts
alter table public.mfit_apply_receipts enable row level security;

create policy "Users see own receipts"
  on public.mfit_apply_receipts for select
  using (auth.uid() = user_id);

create policy "Users insert own receipts"
  on public.mfit_apply_receipts for insert
  with check (auth.uid() = user_id);

-- Index for pipeline queries
create index if not exists mfit_apply_receipts_user_idx
  on public.mfit_apply_receipts (user_id, submitted_at desc);
