-- Production AI workflow runtime
-- Source strategy: "Building Production AI Workflows in n8n"
-- Deterministic workflow state first; LLMs are bounded steps, not the control plane.

create table if not exists public.ai_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_key text not null,
  workflow_version integer not null default 1 check (workflow_version > 0),
  input_fingerprint text not null,
  source_channel text not null default 'web'
    check (source_channel in ('web','mobile','extension','whatsapp','gmail','calendar','system')),
  execution_mode text not null default 'synchronous'
    check (execution_mode in ('synchronous','asynchronous')),
  status text not null default 'queued'
    check (status in ('queued','running','awaiting_approval','succeeded','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  provider text,
  model text,
  cache_hit boolean not null default false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_workflow_runs_user_time_idx
  on public.ai_workflow_runs(user_id, created_at desc);
create index if not exists ai_workflow_runs_key_time_idx
  on public.ai_workflow_runs(user_id, workflow_key, created_at desc);
create index if not exists ai_workflow_runs_status_idx
  on public.ai_workflow_runs(status, updated_at);

alter table public.ai_workflow_runs enable row level security;
drop policy if exists "ai workflow runs owner read" on public.ai_workflow_runs;
create policy "ai workflow runs owner read"
on public.ai_workflow_runs for select to authenticated
using (user_id = auth.uid());

create table if not exists public.ai_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_workflow_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_key text not null,
  step_index integer not null default 0,
  step_type text not null
    check (step_type in ('deterministic','llm','tool','cache','approval')),
  status text not null default 'running'
    check (status in ('running','succeeded','failed','skipped')),
  attempt integer not null default 1 check (attempt > 0),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_workflow_steps_run_idx
  on public.ai_workflow_steps(run_id, step_index, created_at);

alter table public.ai_workflow_steps enable row level security;
drop policy if exists "ai workflow steps owner read" on public.ai_workflow_steps;
create policy "ai workflow steps owner read"
on public.ai_workflow_steps for select to authenticated
using (user_id = auth.uid());

create table if not exists public.ai_workflow_approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ai_workflow_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  status text not null default 'pending'
    check (status in ('pending','sending','approved','rejected','failed')),
  payload jsonb not null default '{}'::jsonb,
  payload_fingerprint text not null,
  result jsonb not null default '{}'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (run_id, action_key)
);

create index if not exists ai_workflow_approvals_user_status_idx
  on public.ai_workflow_approvals(user_id, status, created_at desc);

alter table public.ai_workflow_approvals enable row level security;
drop policy if exists "ai workflow approvals owner read" on public.ai_workflow_approvals;
create policy "ai workflow approvals owner read"
on public.ai_workflow_approvals for select to authenticated
using (user_id = auth.uid());

create table if not exists public.ai_workflow_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_key text not null,
  namespace text not null default 'default',
  cache_key text not null,
  source_fingerprint text not null,
  payload jsonb not null default '{}'::jsonb,
  hit_count bigint not null default 0,
  last_hit_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, workflow_key, namespace, cache_key, source_fingerprint)
);

create index if not exists ai_workflow_cache_lookup_idx
  on public.ai_workflow_cache(user_id, workflow_key, namespace, cache_key);

alter table public.ai_workflow_cache enable row level security;
drop policy if exists "ai workflow cache owner read" on public.ai_workflow_cache;
create policy "ai workflow cache owner read"
on public.ai_workflow_cache for select to authenticated
using (user_id = auth.uid());
