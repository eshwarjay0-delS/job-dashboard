-- Cover memory graph and provenance foreign keys reported by Supabase advisors.
create index if not exists memory_claim_sources_event_idx on public.memory_claim_sources(event_id);
create index if not exists memory_claims_supersedes_idx on public.memory_claims(supersedes_claim_id) where supersedes_claim_id is not null;
create index if not exists memory_consolidations_parent_idx on public.memory_consolidations(parent_id) where parent_id is not null;
create index if not exists memory_constraints_source_event_idx on public.memory_constraints(source_event_id) where source_event_id is not null;
create index if not exists memory_constraints_supersedes_idx on public.memory_constraints(supersedes_constraint_id) where supersedes_constraint_id is not null;
create index if not exists memory_edges_to_event_cover_idx on public.memory_edges(to_event_id);
