-- Jev data access plane
-- Jev is the persistent retrieval and provenance service used by the internal agent.
-- The internal agent remains responsible for live reasoning and may request iterative retrieval.

create table if not exists public.jev_data_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  source_kind text not null check (source_kind in (
    'kompas_model','temporal_memory','connected_app','conversation','artifact','profile','cache','external_reference','other'
  )),
  display_name text not null,
  capabilities jsonb not null default '{}'::jsonb,
  locator jsonb not null default '{}'::jsonb,
  priority smallint not null default 50 check (priority between 0 and 100),
  active boolean not null default true,
  access_mode text not null default 'read' check (access_mode in ('read','read_write','derived_only')),
  provenance_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_key)
);

create table if not exists public.jev_retrieval_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  profile_key text not null,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, profile_key, version)
);

create table if not exists public.jev_access_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  request_key text,
  purpose text not null,
  query_text text,
  interviewer_role text,
  difficulty smallint check (difficulty between 1 and 5),
  technical_depth smallint check (technical_depth between 1 and 5),
  answer_maturity smallint check (answer_maturity between 1 and 5),
  kompas_model_id uuid references public.kompas_knowledge_models(id) on delete set null,
  profile_key text not null default 'default',
  requested_sources text[] not null default '{}'::text[],
  selected_sources text[] not null default '{}'::text[],
  policy_snapshot jsonb not null default '{}'::jsonb,
  retrieval_ms integer,
  status text not null default 'started' check (status in ('started','ready','partial','failed','cancelled')),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.jev_access_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.jev_access_runs(id) on delete cascade,
  source_key text not null,
  source_kind text not null,
  source_ref text,
  source_version text,
  rank integer not null default 0,
  score real check (score is null or (score >= 0 and score <= 1)),
  selection_reason text,
  content_summary text,
  provenance jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.jev_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kompas_model_id uuid references public.kompas_knowledge_models(id) on delete cascade,
  session_id text,
  snapshot_key text not null,
  source_fingerprint text,
  policy_hash text,
  context_payload jsonb not null default '{}'::jsonb,
  provenance_manifest jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  hit_count bigint not null default 0,
  stale_at timestamptz,
  unique (user_id, snapshot_key)
);

create index if not exists jev_data_sources_user_active_idx
  on public.jev_data_sources(user_id, active, priority desc);
create index if not exists jev_access_runs_user_created_idx
  on public.jev_access_runs(user_id, created_at desc);
create index if not exists jev_access_runs_model_idx
  on public.jev_access_runs(kompas_model_id, created_at desc);
create index if not exists jev_access_results_run_rank_idx
  on public.jev_access_results(run_id, rank);
create index if not exists jev_context_snapshots_lookup_idx
  on public.jev_context_snapshots(user_id, kompas_model_id, session_id, stale_at);

alter table public.jev_data_sources enable row level security;
alter table public.jev_retrieval_profiles enable row level security;
alter table public.jev_access_runs enable row level security;
alter table public.jev_access_results enable row level security;
alter table public.jev_context_snapshots enable row level security;

drop policy if exists "jev data sources owner" on public.jev_data_sources;
create policy "jev data sources owner" on public.jev_data_sources for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "jev retrieval profiles owner or global" on public.jev_retrieval_profiles;
create policy "jev retrieval profiles owner or global" on public.jev_retrieval_profiles for select to authenticated
  using (user_id is null or user_id = auth.uid());

drop policy if exists "jev retrieval profiles owner write" on public.jev_retrieval_profiles;
create policy "jev retrieval profiles owner write" on public.jev_retrieval_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "jev access runs owner" on public.jev_access_runs;
create policy "jev access runs owner" on public.jev_access_runs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "jev access results owner" on public.jev_access_results;
create policy "jev access results owner" on public.jev_access_results for all to authenticated
  using (exists (select 1 from public.jev_access_runs r where r.id = run_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.jev_access_runs r where r.id = run_id and r.user_id = auth.uid()));

drop policy if exists "jev context snapshots owner" on public.jev_context_snapshots;
create policy "jev context snapshots owner" on public.jev_context_snapshots for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.jev_retrieval_profiles(user_id, profile_key, version, active, policy)
values (
  null,
  'kompas_interview_default',
  1,
  true,
  '{
    "orchestrator": "Jev + internal agent",
    "rule": "Jev resolves, ranks, scopes, caches and preserves provenance while the internal agent reasons over context and may request more retrieval.",
    "source_order": ["kompas_model","temporal_memory","conversation","artifact","connected_app","profile","cache","external_reference"],
    "merge_behavior": {
      "resume_and_jd": "use_existing_unified_kompas_model",
      "prefer_cached_knowledge": true,
      "reuse_unchanged_nodes": true,
      "invalidate_only_affected_context": true
    },
    "retrieval_behavior": {
      "candidate_evidence_before_generic_knowledge": true,
      "preserve_source_provenance": true,
      "return_conflicts_instead_of_silently_resolving": true,
      "respect_session_role_and_depth": true,
      "never_promote_scenario_to_candidate_history": true
    }
  }'::jsonb
)
on conflict (user_id, profile_key, version) do nothing;
