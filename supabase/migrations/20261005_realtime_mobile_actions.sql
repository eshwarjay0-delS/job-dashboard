-- Durable async actions for realtime mobile requests.
create table if not exists public.realtime_mobile_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.realtime_mobile_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  action_type text not null,
  status text not null default 'accepted'
    check (status in ('accepted','running','succeeded','failed','cancelled')),
  workflow_run_id uuid references public.ai_workflow_runs(id) on delete set null,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, request_id)
);

create index if not exists realtime_mobile_actions_user_status_idx
  on public.realtime_mobile_actions(user_id, status, updated_at desc);
create index if not exists realtime_mobile_actions_session_idx
  on public.realtime_mobile_actions(session_id, created_at desc);
create index if not exists realtime_mobile_actions_workflow_run_idx
  on public.realtime_mobile_actions(workflow_run_id)
  where workflow_run_id is not null;

alter table public.realtime_mobile_actions enable row level security;

drop policy if exists "realtime mobile actions owner read" on public.realtime_mobile_actions;
create policy "realtime mobile actions owner read"
on public.realtime_mobile_actions
for select to authenticated
using (user_id = (select auth.uid()));
