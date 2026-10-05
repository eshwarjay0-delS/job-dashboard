-- Kompas knowledge model v2
-- Build once, render many: resume + JD become one reusable source-of-truth model.
-- This migration is additive and mirrors the schema applied to the Mfit Supabase project on 2026-10-05.

create table if not exists public.kompas_model_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null,
  version integer not null default 1 check (version > 0),
  active boolean not null default true,
  persona text not null default 'Thomas',
  policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_key, version)
);

create table if not exists public.kompas_knowledge_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_key text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'ready' check (status in ('building','ready','stale','superseded','failed')),
  title text,
  source_fingerprint text not null,
  resume_fingerprint text,
  jd_fingerprint text,
  schema_version integer not null default 2,
  comprehension_depth text not null default 'deep' check (comprehension_depth in ('standard','deep','very_deep')),
  supersedes_model_id uuid references public.kompas_knowledge_models(id) on delete set null,
  synthesis_summary jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_materialized_at timestamptz,
  unique (user_id, model_key, version),
  unique (user_id, source_fingerprint, schema_version)
);

create table if not exists public.kompas_knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.kompas_knowledge_models(id) on delete cascade,
  source_kind text not null check (source_kind in ('resume','jd','portfolio','transcript','dossier','research','feedback','session','artifact','other')),
  source_key text not null,
  source_version text,
  source_hash text not null,
  source_record_id uuid,
  locator jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  extracted_facts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (model_id, source_kind, source_key, source_hash)
);

create table if not exists public.kompas_knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.kompas_knowledge_models(id) on delete cascade,
  canonical_key text not null,
  node_type text not null check (node_type in (
    'keyword','technology','concept','requirement','responsibility','experience','project','claim',
    'architecture','protocol','data_flow','attack_path','failure_mode','control','test','debugging',
    'remediation','business_impact','tradeoff','metric','example','scenario','question','answer',
    'followup','caveat','story','other'
  )),
  label text not null,
  body jsonb not null default '{}'::jsonb,
  technical_depth smallint not null default 3 check (technical_depth between 1 and 5),
  business_depth smallint not null default 3 check (business_depth between 1 and 5),
  evidence_confidence real not null default 1 check (evidence_confidence >= 0 and evidence_confidence <= 1),
  source_coverage jsonb not null default '[]'::jsonb,
  state text not null default 'active' check (state in ('active','carried_forward','stale','superseded','rejected')),
  derived_from_node_id uuid references public.kompas_knowledge_nodes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, canonical_key)
);

create table if not exists public.kompas_knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.kompas_knowledge_models(id) on delete cascade,
  from_node_id uuid not null references public.kompas_knowledge_nodes(id) on delete cascade,
  to_node_id uuid not null references public.kompas_knowledge_nodes(id) on delete cascade,
  edge_type text not null check (edge_type in (
    'requires','implements','explains','evidences','maps_to','depends_on','fails_as','tested_by',
    'remediated_by','impacts','measured_by','example_of','followup_of','contradicts','supports',
    'supersedes','same_topic','used_in','derived_from'
  )),
  weight real not null default 1 check (weight >= 0 and weight <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (model_id, from_node_id, to_node_id, edge_type)
);

create table if not exists public.kompas_presentation_layers (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.kompas_knowledge_models(id) on delete cascade,
  node_id uuid references public.kompas_knowledge_nodes(id) on delete cascade,
  audience text not null check (audience in ('engineer','director','hiring_manager','recruiter','peer','mixed')),
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  narrative_mode text not null default 'first_person' check (narrative_mode in ('first_person','study','reference')),
  content jsonb not null default '{}'::jsonb,
  renderer_version text not null default 'thomas-v2',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, node_id, audience, difficulty, narrative_mode, renderer_version)
);

create table if not exists public.kompas_interview_bundles (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.kompas_knowledge_models(id) on delete cascade,
  bundle_key text not null,
  interviewer_role text not null default 'mixed',
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  technical_depth smallint not null default 3 check (technical_depth between 1 and 5),
  answer_maturity smallint not null default 3 check (answer_maturity between 1 and 5),
  payload jsonb not null default '{}'::jsonb,
  source_fingerprint text not null,
  renderer_version text not null default 'thomas-v2',
  generated_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (model_id, bundle_key, interviewer_role, difficulty, technical_depth, answer_maturity, renderer_version)
);

create table if not exists public.kompas_generation_cache (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.kompas_knowledge_models(id) on delete cascade,
  cache_kind text not null check (cache_kind in ('pdf','prep','question_bank','answer','session_bundle','keyword_explainer','dossier','other')),
  cache_key text not null,
  content_hash text not null,
  source_fingerprint text not null,
  renderer_version text not null,
  payload jsonb not null default '{}'::jsonb,
  artifact_locator jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  hit_count bigint not null default 0,
  stale_at timestamptz,
  unique (model_id, cache_kind, cache_key, renderer_version, source_fingerprint)
);

create table if not exists public.kompas_model_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid references public.kompas_knowledge_models(id) on delete cascade,
  node_id uuid references public.kompas_knowledge_nodes(id) on delete set null,
  feedback_type text not null check (feedback_type in (
    'approval','rejection','correction','depth','narrative','example_quality','technical_accuracy',
    'business_relevance','session_behavior','artifact_quality','other'
  )),
  source_channel text not null default 'web' check (source_channel in ('web','mobile','voice','pdf','session','system','other')),
  feedback jsonb not null default '{}'::jsonb,
  reuse_scope text not null default 'model' check (reuse_scope in ('node','model','persona','global_eval')),
  evaluation_eligible boolean not null default true,
  training_eligible boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists kompas_knowledge_models_user_ready_idx on public.kompas_knowledge_models(user_id, status, updated_at desc);
create index if not exists kompas_knowledge_models_source_idx on public.kompas_knowledge_models(user_id, source_fingerprint, schema_version);
create index if not exists kompas_knowledge_sources_model_idx on public.kompas_knowledge_sources(model_id, source_kind);
create index if not exists kompas_knowledge_nodes_model_type_idx on public.kompas_knowledge_nodes(model_id, node_type, state);
create index if not exists kompas_knowledge_edges_from_idx on public.kompas_knowledge_edges(model_id, from_node_id, edge_type);
create index if not exists kompas_knowledge_edges_to_idx on public.kompas_knowledge_edges(model_id, to_node_id, edge_type);
create index if not exists kompas_presentation_layers_model_audience_idx on public.kompas_presentation_layers(model_id, audience, difficulty);
create index if not exists kompas_interview_bundles_lookup_idx on public.kompas_interview_bundles(model_id, interviewer_role, difficulty, technical_depth, answer_maturity);
create index if not exists kompas_generation_cache_lookup_idx on public.kompas_generation_cache(model_id, cache_kind, cache_key, renderer_version);
create index if not exists kompas_model_feedback_model_idx on public.kompas_model_feedback(model_id, created_at desc);

alter table public.kompas_model_policies enable row level security;
alter table public.kompas_knowledge_models enable row level security;
alter table public.kompas_knowledge_sources enable row level security;
alter table public.kompas_knowledge_nodes enable row level security;
alter table public.kompas_knowledge_edges enable row level security;
alter table public.kompas_presentation_layers enable row level security;
alter table public.kompas_interview_bundles enable row level security;
alter table public.kompas_generation_cache enable row level security;
alter table public.kompas_model_feedback enable row level security;

drop policy if exists "kompas model policies readable" on public.kompas_model_policies;
create policy "kompas model policies readable" on public.kompas_model_policies for select to authenticated using (active = true);

drop policy if exists "kompas knowledge models owner" on public.kompas_knowledge_models;
create policy "kompas knowledge models owner" on public.kompas_knowledge_models for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "kompas knowledge sources owner" on public.kompas_knowledge_sources;
create policy "kompas knowledge sources owner" on public.kompas_knowledge_sources for all to authenticated
  using (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()));

drop policy if exists "kompas knowledge nodes owner" on public.kompas_knowledge_nodes;
create policy "kompas knowledge nodes owner" on public.kompas_knowledge_nodes for all to authenticated
  using (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()));

drop policy if exists "kompas knowledge edges owner" on public.kompas_knowledge_edges;
create policy "kompas knowledge edges owner" on public.kompas_knowledge_edges for all to authenticated
  using (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()));

drop policy if exists "kompas presentation layers owner" on public.kompas_presentation_layers;
create policy "kompas presentation layers owner" on public.kompas_presentation_layers for all to authenticated
  using (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()));

drop policy if exists "kompas interview bundles owner" on public.kompas_interview_bundles;
create policy "kompas interview bundles owner" on public.kompas_interview_bundles for all to authenticated
  using (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()));

drop policy if exists "kompas generation cache owner" on public.kompas_generation_cache;
create policy "kompas generation cache owner" on public.kompas_generation_cache for all to authenticated
  using (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.kompas_knowledge_models m where m.id = model_id and m.user_id = auth.uid()));

drop policy if exists "kompas model feedback owner" on public.kompas_model_feedback;
create policy "kompas model feedback owner" on public.kompas_model_feedback for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.kompas_model_policies(policy_key, version, active, persona, policy)
values (
  'thomas_interview_companion',
  2,
  true,
  'Thomas',
  '{
    "source_contract": {
      "resume_and_jd": "always_merge",
      "normalized_keywords": "persist_and_reuse",
      "incremental_updates": true,
      "source_provenance_required": true,
      "do_not_regenerate_unchanged_knowledge": true
    },
    "comprehension": {
      "internal_depth": "very_deep",
      "must_exceed_presentation_depth": true,
      "build_once_render_many": true
    },
    "presentation": {
      "default_narrative": "first_person",
      "audience_layers": ["engineer", "director", "mixed"],
      "engineer_focus": ["implementation", "architecture", "protocols", "data_flow", "failure_modes", "attack_paths", "tests", "debugging", "code_config", "remediation"],
      "director_focus": ["business_impact", "risk_tradeoffs", "ownership", "prioritization", "metrics", "delivery_constraints", "cross_team_decisions", "strategic_consequences"],
      "examples": "real_field_project_bottleneck",
      "tone": ["meticulous", "precise", "natural", "companion_like", "technically_mature"]
    },
    "avoid": [
      "meta_interview_rules_as_primary_content",
      "conversation_starting_scripts_as_primary_content",
      "toy_or_childish_analogies_in_interview_outputs",
      "generic_best_practice_without_system_context",
      "repeating_resume_or_jd_without_teaching",
      "unsupported_candidate_history",
      "keyword_dump_without_relationships"
    ],
    "session": {
      "perspective_changes_with_interviewer_role": true,
      "difficulty_is_runtime_variable": true,
      "technical_depth_is_runtime_variable": true,
      "answer_maturity_is_runtime_variable": true,
      "same_knowledge_model_for_pdf_prep_and_live_session": true
    },
    "cache": {
      "keyed_by_source_fingerprint": true,
      "invalidate_only_affected_derivations": true,
      "precompute_interview_bundles": true
    }
  }'::jsonb
)
on conflict (policy_key, version) do update
set active = excluded.active,
    persona = excluded.persona,
    policy = excluded.policy,
    updated_at = now();
