-- Kompas narration maturity case library
-- Stores source-grounded narration cases separately from candidate facts.
-- Semantic narration patterns are gated until transcript evidence exists.

create table if not exists public.kompas_narration_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_key text not null,
  source_title text not null,
  source_filename text not null,
  source_sha256 text not null,
  source_kind text not null default 'audio' check (source_kind in ('audio','transcript','paired_audio_transcript','synthetic_eval')),
  duration_seconds numeric not null check (duration_seconds > 0),
  semantic_status text not null default 'pending_transcript' check (semantic_status in ('pending_transcript','partial','transcribed','reviewed')),
  semantic_basis text not null default 'title_only' check (semantic_basis in ('title_only','partial_listening','transcript','reviewed_transcript')),
  case_archetype_hint text,
  acoustic_profile jsonb not null default '{}'::jsonb,
  narrative_observations jsonb not null default '{}'::jsonb,
  maturity_targets jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  evaluation_eligible boolean not null default true,
  training_eligible boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_sha256)
);

create table if not exists public.kompas_narration_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_key text not null,
  version integer not null default 1 check (version > 0),
  pattern_type text not null check (pattern_type in (
    'cadence','progression','contrast','example','technical_depth','business_depth',
    'interviewer_adaptation','clarity','tension_resolution','closing','prosody','other'
  )),
  title text not null,
  description text not null,
  operational_rule jsonb not null default '{}'::jsonb,
  evidence_basis text not null default 'derived' check (evidence_basis in ('acoustic','title_plus_acoustic','transcript','derived','human_feedback')),
  confidence real not null default 1 check (confidence >= 0 and confidence <= 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pattern_key, version)
);

create table if not exists public.kompas_narration_case_patterns (
  case_id uuid not null references public.kompas_narration_cases(id) on delete cascade,
  pattern_id uuid not null references public.kompas_narration_patterns(id) on delete cascade,
  weight real not null default 1 check (weight >= 0 and weight <= 1),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (case_id, pattern_id)
);

create index if not exists kompas_narration_cases_user_active_idx
  on public.kompas_narration_cases(user_id, active, updated_at desc);
create index if not exists kompas_narration_cases_archetype_idx
  on public.kompas_narration_cases(user_id, case_archetype_hint);
create index if not exists kompas_narration_patterns_type_idx
  on public.kompas_narration_patterns(pattern_type, active);

alter table public.kompas_narration_cases enable row level security;
alter table public.kompas_narration_patterns enable row level security;
alter table public.kompas_narration_case_patterns enable row level security;

drop policy if exists "kompas narration cases owner" on public.kompas_narration_cases;
create policy "kompas narration cases owner"
  on public.kompas_narration_cases for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "kompas narration patterns readable" on public.kompas_narration_patterns;
create policy "kompas narration patterns readable"
  on public.kompas_narration_patterns for select to authenticated
  using (active = true);

drop policy if exists "kompas narration case patterns owner" on public.kompas_narration_case_patterns;
create policy "kompas narration case patterns owner"
  on public.kompas_narration_case_patterns for all to authenticated
  using (exists (
    select 1 from public.kompas_narration_cases c
    where c.id = case_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.kompas_narration_cases c
    where c.id = case_id and c.user_id = auth.uid()
  ));

insert into public.kompas_narration_patterns(pattern_key,version,pattern_type,title,description,operational_rule,evidence_basis,confidence)
values
('dense_continuity',1,'cadence','Dense continuity without breathlessness',
 'Maintain a high information-carrying speech ratio while using frequent clause-level micro-pauses.',
 '{"target_speech_occupancy":[0.86,0.90],"median_pause_seconds":[0.38,0.43]}'::jsonb,
 'acoustic',0.94),
('micro_pause_clause_rhythm',1,'prosody','Clause-level micro-pause rhythm',
 'Use short pauses often enough to separate idea units, while reserving long silence for transitions or emphasis.',
 '{"pause_events_per_minute":[14,18],"preferred_median_pause_seconds":[0.38,0.43],"long_pause_share_max":0.07}'::jsonb,
 'acoustic',0.94),
('controlled_dynamic_range',1,'prosody','Controlled vocal dynamic range',
 'Keep energy stable enough for comfortable comprehension while preserving enough variation to avoid flat delivery.',
 '{"loudness_range_lu":[5.5,6.1]}'::jsonb,
 'acoustic',0.92),
('topic_conditioned_cadence',1,'cadence','Cadence changes with reasoning mode',
 'Do not use one universal delivery tempo. Pacing should change with reasoning density, audience and stakes.',
 '{"conditioning":["topic_type","interviewer_role","reasoning_density","stakes"]}'::jsonb,
 'title_plus_acoustic',0.72),
('semantic_maturity_gate',1,'clarity','Do not learn semantic narration rules from title alone',
 'Acoustic behavior may be learned immediately, but semantic sequencing, analogies, claims and examples require transcript-grounded evidence.',
 '{"pending_transcript_behavior":"store audio metrics and case hints only","promotion_requirement":"transcript or reviewed semantic extraction"}'::jsonb,
 'derived',1.0)
on conflict (pattern_key,version)
do update set
  pattern_type=excluded.pattern_type,title=excluded.title,description=excluded.description,
  operational_rule=excluded.operational_rule,evidence_basis=excluded.evidence_basis,
  confidence=excluded.confidence,active=true,updated_at=now();
