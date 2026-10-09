-- ── Candidate reply profiles ──────────────────────────────────────────────
-- One saved profile per user per connected Google account. Powers the Gmail
-- Smart Reply feature: suggestion chips in /dashboard/mail auto-fill reply
-- drafts from these fields (including sensitive ones the user enters himself
-- in the Connections profile editor). Nothing is ever sent without the user's
-- explicit "Approve & Send" tap.
-- NOTE: run this in Supabase SQL editor (like the 20261008 migration).

create table if not exists public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_email text not null,

  -- identity / contact
  full_name text not null default '',
  phone text not null default '',
  email text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  linkedin text not null default '',

  -- work
  work_auth text not null default '',
  availability text not null default '',
  interview_availability text not null default '',
  education text not null default '',
  total_experience text not null default '',
  relevant_experience text not null default '',
  employer_name text not null default '',
  employer_contact_name text not null default '',
  employer_contact_phone text not null default '',
  rate_default text not null default '',
  notes text not null default '',

  -- private details (user-entered; only ever read back to the same user)
  ssn_last4 text not null default '',
  dob text not null default '',
  passport_no text not null default '',
  dl_number text not null default '',
  dl_state text not null default '',

  updated_at timestamptz not null default now(),
  unique (user_id, google_email)
);

create index if not exists candidate_profiles_user_idx
  on public.candidate_profiles(user_id);

alter table public.candidate_profiles enable row level security;

drop policy if exists candidate_profiles_owner on public.candidate_profiles;
create policy candidate_profiles_owner on public.candidate_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
