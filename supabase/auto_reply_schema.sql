-- ============================================================================
--  Auto-Reply Loop — schema  (additive; safe to re-run)
-- ============================================================================
--  Run once in Supabase → SQL Editor, same convention as supabase/schema.sql.
--
--  Scope of this file: milestones M1 (discovery) + M2 (recruiter selection).
--  Nothing here writes to Gmail; these tables record what the loop FOUND and
--  what it WOULD do, so the algorithm can be graded before it can act.
-- ============================================================================

-- ── Columns the Gmail connect flow already writes but schema.sql never declared
-- src/app/auth/callback/gmail/route.ts:57-65 updates these inside a try/catch
-- that swallows errors — so if the columns are missing the token is silently
-- lost and nothing surfaces. Declare them explicitly.
alter table public.profiles add column if not exists gmail_refresh_token text;
alter table public.profiles add column if not exists gmail_connected_at  timestamptz;
-- New: what Google actually GRANTED, so we can refuse to attempt a send on a
-- read-only token instead of discovering it as a 403 on the last step.
alter table public.profiles add column if not exists gmail_granted_scope text;
alter table public.profiles add column if not exists gmail_address       text;

-- ── Job state ───────────────────────────────────────────────────────────────
do $$ begin
  create type public.auto_reply_state as enum (
    'discovered',          -- draft matched the allowlist; nothing read yet
    'jd_extracted',        -- recruiter message located, JD captured
    'recruiter_resolved',  -- vendor identified and assertions passed
    'awaiting_approval',   -- prepared, held for a human
    'needs_human',         -- fail-closed: ambiguous or an assertion failed
    'skipped',             -- not applicable (no JD, already replied, …)
    'rejected',            -- user declined
    'cancelled'            -- draft deleted, or allowlist no longer matches
  );
exception when duplicate_object then null; end $$;

-- ── Settings (autonomy is a row, not a rewrite) ─────────────────────────────
create table if not exists public.auto_reply_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,

  enabled            boolean not null default false,
  autonomy           text    not null default 'supervised'
                             check (autonomy in ('supervised','auto')),
  dry_run            boolean not null default true,

  kill_switch        boolean not null default false,
  kill_reason        text,
  killed_at          timestamptz,

  -- Matching. Terms are matched against a whole DOMAIN LABEL, never as a bare
  -- substring of the address: "tekblu" must match tekblu.us and tekblu.com but
  -- NOT cloudquestit@gmail.com or tekblu.attacker.com.
  self_email         text,
  sender_allowlist   text[]  not null default array['tekblu','cloudquestit'],
  freemail_domains   text[]  not null default array[
                       'gmail','googlemail','yahoo','ymail','rocketmail','outlook','hotmail',
                       'live','msn','icloud','me','mac','aol','proton','protonmail','gmx',
                       'mail','zoho','yandex','fastmail','rediffmail','comcast','att',
                       'verizon','sbcglobal','cox','bellsouth','charter'],
  -- Age BAND, not a single window. Drafts younger than min_age_days are left
  -- alone (the recruiter may still be mid-conversation); older than
  -- lookback_days is stale. Default 3..7 days.
  min_age_days       smallint not null default 3  check (min_age_days between 0 and 60),
  lookback_days      smallint not null default 7  check (lookback_days between 1 and 90),

  -- Cc the middleman who forwarded the requisition? Default FALSE: replies go
  -- to the recruiter alone (decided 2026-08-31, "to just recruiters without
  -- middlemen"). Turning this on puts tekblu/cloudquestit back in copy.
  cc_middleman       boolean not null default false,

  base_resume_filepath text,   -- passed to /api/tailor as `filepath`; NEVER auto-match

  -- Caps are enforced as SQL COUNTs. src/lib/rateLimit.ts is an in-memory Map,
  -- per-instance and reset on redeploy — unusable for anything irreversible.
  max_sends_per_run  smallint not null default 3  check (max_sends_per_run between 0 and 20),
  max_sends_per_day  smallint not null default 15 check (max_sends_per_day between 0 and 100),
  timezone           text not null default 'America/Chicago',

  updated_at         timestamptz not null default now()
);

-- ── Run log (heartbeat + the overlap lock) ──────────────────────────────────
create table if not exists public.auto_reply_run (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  trigger     text not null default 'cron' check (trigger in ('cron','manual','ui')),
  github_run  text,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms int,
  dry_run     boolean not null default true,
  discovered  int not null default 0,
  advanced    int not null default 0,
  failed      int not null default 0,
  halted      boolean not null default false,
  halt_reason text
);
create index if not exists auto_reply_run_user_idx
  on public.auto_reply_run(user_id, started_at desc);
-- At most one live run per user: a second concurrent tick gets 23505 → HTTP 409.
create unique index if not exists auto_reply_run_active_uniq
  on public.auto_reply_run(user_id) where finished_at is null;

-- ── Jobs ────────────────────────────────────────────────────────────────────
create table if not exists public.auto_reply_job (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,

  gmail_thread_id      text not null,
  gmail_draft_id       text not null,
  draft_fingerprint    text,           -- sha256 of the draft; detects edits between ticks

  -- sha256(user_id | thread_id | draft_id). One job per draft, forever.
  idempotency_key      text not null,

  state                public.auto_reply_state not null default 'discovered',
  prev_state           public.auto_reply_state,
  attempts             smallint not null default 0,
  next_attempt_at      timestamptz not null default now(),
  last_error           text,
  halt_code            text,

  -- Extracted content
  middleman_email      text not null,  -- the allowlisted sender the JD came from
  middleman_name       text,
  subject              text,
  jd_text              text,
  role_title           text,
  jd_location          text,
  jd_remote            boolean,
  jd_skills            text[] not null default '{}',

  -- Addressing, as read from the ORIGINAL message header
  thread_to            text[] not null default '{}',
  thread_cc            text[] not null default '{}',
  recruiter_to         text[] not null default '{}',
  recruiter_cc         text[] not null default '{}',
  recruiter_source     text check (recruiter_source in ('rule','rule+learned','learned','user_override')),
  recruiter_rationale  text,
  -- Every address on the thread with its classification and why it was kept or
  -- dropped. This is what makes the decision auditable rather than magic.
  recruiter_candidates jsonb not null default '[]'::jsonb,

  skip_reason          text,
  rejected_reason      text,
  approved_by_user     boolean not null default false,
  approved_at          timestamptz,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists auto_reply_job_idem_uniq
  on public.auto_reply_job(idempotency_key);
create unique index if not exists auto_reply_job_draft_uniq
  on public.auto_reply_job(user_id, gmail_draft_id);
create index if not exists auto_reply_job_runnable_idx
  on public.auto_reply_job(user_id, next_attempt_at, state)
  where state not in ('skipped','rejected','cancelled');
create index if not exists auto_reply_job_user_updated_idx
  on public.auto_reply_job(user_id, updated_at desc);

-- ── Append-only decision / audit log ────────────────────────────────────────
create table if not exists public.auto_reply_event (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      uuid references public.auto_reply_job(id) on delete cascade,
  run_id      uuid references public.auto_reply_run(id) on delete set null,
  at          timestamptz not null default now(),

  actor       text not null check (actor in ('loop','user','system')),
  kind        text not null check (kind in
                ('state_change','decision','override','error','gmail_call','cap_hit','halt')),
  from_state  public.auto_reply_state,
  to_state    public.auto_reply_state,

  decision    text,
  chosen      jsonb,
  rejected    jsonb,     -- each dropped address + the reason it was dropped
  rationale   text,      -- one human sentence, rendered verbatim in the UI
  payload     jsonb not null default '{}'::jsonb
);
create index if not exists auto_reply_event_job_idx  on public.auto_reply_event(job_id, at desc);
create index if not exists auto_reply_event_user_idx on public.auto_reply_event(user_id, at desc);

-- ── Recruiter learning store ────────────────────────────────────────────────
create table if not exists public.auto_reply_recruiter_stat (
  user_id               uuid not null references auth.users(id) on delete cascade,
  address               text not null,
  domain                text not null,
  via_middleman_domain  text,          -- recruiter rosters are per-vendor

  times_seen            int not null default 0,
  times_proposed        int not null default 0,
  times_confirmed       int not null default 0,
  times_chosen_by_user  int not null default 0,
  times_overridden_away int not null default 0,
  times_sent            int not null default 0,
  times_bounced         int not null default 0,

  is_freemail           boolean not null default false,
  is_middleman          boolean not null default false,
  blocked               boolean not null default false,
  blocked_reason        text,

  trust                 numeric(5,4) not null default 0,

  first_seen            timestamptz not null default now(),
  last_seen             timestamptz not null default now(),
  last_confirmed_at     timestamptz,

  primary key (user_id, address)
);
create index if not exists auto_reply_recruiter_domain_idx
  on public.auto_reply_recruiter_stat(user_id, domain);
create index if not exists auto_reply_recruiter_trust_idx
  on public.auto_reply_recruiter_stat(user_id, trust desc) where not blocked;

-- ── RLS: the browser reads; only the service role writes ────────────────────
-- Every mutation goes through an API route that verifies auth.getUser() and then
-- writes with the service-role key, so the state machine can never be advanced
-- from a devtools console.
alter table public.auto_reply_settings       enable row level security;
alter table public.auto_reply_run            enable row level security;
alter table public.auto_reply_job            enable row level security;
alter table public.auto_reply_event          enable row level security;
alter table public.auto_reply_recruiter_stat enable row level security;

do $$ begin
  create policy "own auto_reply settings read"  on public.auto_reply_settings
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own auto_reply runs read"      on public.auto_reply_run
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own auto_reply jobs read"      on public.auto_reply_job
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own auto_reply events read"    on public.auto_reply_event
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own auto_reply recruiters read" on public.auto_reply_recruiter_stat
    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── Additive: columns introduced after the first version of this file ───────
alter table public.auto_reply_settings add column if not exists min_age_days smallint not null default 3;
alter table public.auto_reply_settings add column if not exists cc_middleman boolean  not null default false;

-- ============================================================================
--  M3 — tailoring (still NO Gmail writes)
-- ============================================================================
-- Adds the two states and the columns needed to attach a tailored resume to a
-- prepared reply. The loop generates the .docx and records where it lives; a
-- human still sends the mail by hand until the send scope exists.

-- ADD VALUE IF NOT EXISTS is PG12+; the create-type block above uses an
-- exception guard and therefore never adds values to an existing enum.
alter type public.auto_reply_state add value if not exists 'tailoring';
alter type public.auto_reply_state add value if not exists 'tailored';

alter table public.auto_reply_job add column if not exists tailor_token      text;
alter table public.auto_reply_job add column if not exists tailor_filename   text;
alter table public.auto_reply_job add column if not exists tailor_score      smallint;
alter table public.auto_reply_job add column if not exists tailor_base_path  text;
alter table public.auto_reply_job add column if not exists tailored_at       timestamptz;
alter table public.auto_reply_job add column if not exists tailor_keywords   jsonb;

-- A tailor call can consume most of a 60s function, so the loop does at most
-- this many per tick. Default 1: with a 20-minute cron that is ~3/hour, which
-- comfortably clears a 3-7 day draft band.
alter table public.auto_reply_settings
  add column if not exists max_tailors_per_run smallint not null default 1
  check (max_tailors_per_run between 0 and 5);

-- Find the next job that still needs a resume.
create index if not exists auto_reply_job_needs_tailor_idx
  on public.auto_reply_job (user_id, updated_at)
  where state = 'recruiter_resolved' and tailor_token is null;

-- The tick reports tailoring alongside discovery, so the run log carries it.
alter table public.auto_reply_run add column if not exists tailored    int not null default 0;
alter table public.auto_reply_run add column if not exists tailor_note text;
