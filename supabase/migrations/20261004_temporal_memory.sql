-- Kompas long term memory foundation.
-- Additive and model independent. Immutable observations remain canonical.
-- Derived claims, constraints and consolidations can be rebuilt at any time.

create extension if not exists vector with schema extensions;

create table if not exists public.memory_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text,
  source_record_id uuid,
  event_type text not null check (event_type in ('utterance','document','image','audio','video','tool','system','feedback')),
  occurred_at timestamptz not null,
  observed_at timestamptz not null default now(),
  content text,
  modality text not null default 'text' check (modality in ('text','image','audio','video','mixed')),
  asset_id text,
  asset_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(384),
  search_tsv tsvector generated always as (to_tsvector('english',coalesce(content,''))) stored
);
create index if not exists memory_events_user_time_idx on public.memory_events(user_id,occurred_at desc);
create index if not exists memory_events_session_idx on public.memory_events(user_id,session_id,occurred_at);
create index if not exists memory_events_tsv_idx on public.memory_events using gin(search_tsv);
create index if not exists memory_events_embedding_hnsw_idx on public.memory_events using hnsw (embedding vector_cosine_ops);
alter table public.memory_events enable row level security;
drop policy if exists "memory_events_self_read" on public.memory_events;
create policy "memory_events_self_read" on public.memory_events for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid())=user_id);
drop policy if exists "memory_events_self_insert" on public.memory_events;
create policy "memory_events_self_insert" on public.memory_events for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid())=user_id);

create table if not exists public.memory_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_key text not null,
  predicate_key text not null,
  value_json jsonb not null,
  normalized_text text not null,
  confidence real not null default 1 check (confidence between 0 and 1),
  status text not null default 'active' check (status in ('active','superseded','disputed','retracted')),
  valid_from timestamptz,
  valid_to timestamptz,
  asserted_at timestamptz not null default now(),
  supersedes_claim_id uuid references public.memory_claims(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists memory_claims_resolution_idx on public.memory_claims(user_id,subject_key,predicate_key,status,valid_from desc,asserted_at desc);
alter table public.memory_claims enable row level security;
drop policy if exists "memory_claims_self_read" on public.memory_claims;
create policy "memory_claims_self_read" on public.memory_claims for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid())=user_id);

create table if not exists public.memory_claim_sources (
  claim_id uuid not null references public.memory_claims(id) on delete cascade,
  event_id uuid not null references public.memory_events(id) on delete cascade,
  support_kind text not null default 'supports' check (support_kind in ('supports','contradicts','updates','derived_from')),
  primary key(claim_id,event_id,support_kind)
);
alter table public.memory_claim_sources enable row level security;
drop policy if exists "memory_claim_sources_self_read" on public.memory_claim_sources;
create policy "memory_claim_sources_self_read" on public.memory_claim_sources for select to authenticated
using (exists(select 1 from public.memory_claims c where c.id=claim_id and c.user_id=(select auth.uid())));

create table if not exists public.memory_constraints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  constraint_key text not null,
  constraint_text text not null,
  scope text not null default 'global' check (scope in ('global','product','workspace','session','role','task')),
  scope_key text,
  origin text not null check (origin in ('explicit','inferred')),
  confidence real not null default 1 check (confidence between 0 and 1),
  priority integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  status text not null default 'active' check (status in ('active','superseded','disputed','retracted')),
  supersedes_constraint_id uuid references public.memory_constraints(id) on delete set null,
  source_event_id uuid references public.memory_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists memory_constraints_active_idx on public.memory_constraints(user_id,status,scope,scope_key,priority desc,valid_from desc);
alter table public.memory_constraints enable row level security;
drop policy if exists "memory_constraints_self_read" on public.memory_constraints;
create policy "memory_constraints_self_read" on public.memory_constraints for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid())=user_id);

create table if not exists public.memory_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_event_id uuid not null references public.memory_events(id) on delete cascade,
  to_event_id uuid not null references public.memory_events(id) on delete cascade,
  edge_type text not null check (edge_type in ('temporal_next','same_entity','causes','caused_by','updates','contradicts','supports','same_episode','references')),
  weight real not null default 1 check (weight between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  unique(from_event_id,to_event_id,edge_type)
);
create index if not exists memory_edges_from_idx on public.memory_edges(user_id,from_event_id,edge_type);
create index if not exists memory_edges_to_idx on public.memory_edges(user_id,to_event_id,edge_type);
alter table public.memory_edges enable row level security;
drop policy if exists "memory_edges_self_read" on public.memory_edges;
create policy "memory_edges_self_read" on public.memory_edges for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid())=user_id);

create table if not exists public.memory_consolidations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.memory_consolidations(id) on delete set null,
  level smallint not null check (level between 0 and 8),
  window_start timestamptz not null,
  window_end timestamptz not null,
  summary text not null,
  source_event_ids uuid[] not null default '{}',
  source_claim_ids uuid[] not null default '{}',
  confidence real not null default 1 check (confidence between 0 and 1),
  embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists memory_consolidations_window_idx on public.memory_consolidations(user_id,level,window_end desc);
create index if not exists memory_consolidations_embedding_hnsw_idx on public.memory_consolidations using hnsw (embedding vector_cosine_ops);
alter table public.memory_consolidations enable row level security;
drop policy if exists "memory_consolidations_self_read" on public.memory_consolidations;
create policy "memory_consolidations_self_read" on public.memory_consolidations for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid())=user_id);

create table if not exists public.memory_retrieval_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query_hash text not null,
  intent text[] not null default '{}',
  selected_event_ids uuid[] not null default '{}',
  selected_claim_ids uuid[] not null default '{}',
  selected_constraint_ids uuid[] not null default '{}',
  selected_consolidation_ids uuid[] not null default '{}',
  conflict_count integer not null default 0,
  retrieval_ms integer,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists memory_retrieval_audit_user_time_idx on public.memory_retrieval_audit(user_id,created_at desc);
alter table public.memory_retrieval_audit enable row level security;
drop policy if exists "memory_retrieval_audit_self_read" on public.memory_retrieval_audit;
create policy "memory_retrieval_audit_self_read" on public.memory_retrieval_audit for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid())=user_id);

-- Derived memory is server managed. Browser clients may read their own rows but may
-- not directly mutate claims, constraints, edges, consolidations or retrieval audits.
grant select,insert on public.memory_events to authenticated;
grant select on public.memory_claims,public.memory_claim_sources,public.memory_constraints,public.memory_edges,public.memory_consolidations,public.memory_retrieval_audit to authenticated;
revoke insert,update,delete on public.memory_claims,public.memory_claim_sources,public.memory_constraints,public.memory_edges,public.memory_consolidations,public.memory_retrieval_audit from authenticated;
