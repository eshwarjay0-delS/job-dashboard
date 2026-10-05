-- Jev + internal agent collaboration loop

alter table public.jev_access_runs
  add column if not exists requester_agent text not null default 'internal_agent',
  add column if not exists parent_run_id uuid references public.jev_access_runs(id) on delete set null,
  add column if not exists retrieval_intent jsonb not null default '{}'::jsonb,
  add column if not exists agent_state_digest jsonb not null default '{}'::jsonb,
  add column if not exists response_contract jsonb not null default '{}'::jsonb;

alter table public.jev_context_snapshots
  add column if not exists consumer_agent text not null default 'internal_agent',
  add column if not exists reasoning_scope jsonb not null default '{}'::jsonb;

create index if not exists jev_access_runs_parent_idx
  on public.jev_access_runs(parent_run_id, created_at);

create table if not exists public.jev_agent_handoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  kompas_model_id uuid references public.kompas_knowledge_models(id) on delete set null,
  run_id uuid references public.jev_access_runs(id) on delete cascade,
  from_actor text not null check (from_actor in ('internal_agent','jev','thomas_renderer','system')),
  to_actor text not null check (to_actor in ('internal_agent','jev','thomas_renderer','system')),
  handoff_type text not null check (handoff_type in (
    'retrieval_request','context_response','gap_request','conflict_notice',
    'provenance_request','cache_hit','cache_miss','final_context','other'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists jev_agent_handoffs_session_idx
  on public.jev_agent_handoffs(user_id, session_id, created_at);
create index if not exists jev_agent_handoffs_run_idx
  on public.jev_agent_handoffs(run_id, created_at);

alter table public.jev_agent_handoffs enable row level security;

drop policy if exists "jev agent handoffs owner" on public.jev_agent_handoffs;
create policy "jev agent handoffs owner" on public.jev_agent_handoffs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

update public.jev_retrieval_profiles
set policy = '{
  "orchestrator": "Jev + internal agent",
  "rule": "Jev and the internal agent work as a retrieval-reasoning loop. Neither is the sole context assembler.",
  "roles": {
    "internal_agent": [
      "understand active question and session state",
      "decide what knowledge is missing",
      "form targeted retrieval intents",
      "reason across returned evidence",
      "detect ambiguity, conflicts and missing depth",
      "request another Jev pass when needed",
      "select the reasoning path for Thomas"
    ],
    "Jev": [
      "resolve persistent Kompas models and temporal memory",
      "retrieve conversation, artifact, profile and connected-source context",
      "rank and scope evidence",
      "preserve provenance and confidence",
      "surface conflicts",
      "reuse cached context",
      "return context snapshots and provenance manifests"
    ],
    "Thomas_renderer": [
      "render the internal agent result in first person",
      "adapt to engineer, director or mixed perspective",
      "never invent unsupported candidate history"
    ]
  },
  "loop": [
    "internal_agent -> Jev: retrieval intent",
    "Jev -> internal_agent: ranked context + provenance + conflicts",
    "internal_agent -> Jev: optional gap retrieval",
    "Jev -> internal_agent: delta context",
    "internal_agent -> Thomas: answer plan",
    "Thomas -> user: first-person response"
  ],
  "source_order": ["kompas_model","temporal_memory","conversation","artifact","connected_app","profile","cache","external_reference"],
  "merge_behavior": {
    "resume_and_jd": "use_existing_unified_kompas_model",
    "prefer_cached_knowledge": true,
    "reuse_unchanged_nodes": true,
    "invalidate_only_affected_context": true
  }
}'::jsonb,
updated_at = now()
where profile_key='kompas_interview_default' and version=1 and user_id is null;

update public.kompas_model_policies
set policy = jsonb_set(
  policy,
  '{data_access}',
  '{
    "collaboration": "Jev + internal agent",
    "exclusive_context_assembly": false,
    "iterative_retrieval": true,
    "cache_and_reuse": true,
    "incremental_invalidation": true
  }'::jsonb,
  true
),
updated_at=now()
where policy_key='thomas_interview_companion' and version=2;
