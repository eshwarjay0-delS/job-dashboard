export type JevActor = "internal_agent" | "jev" | "thomas_renderer" | "system";

export type JevHandoffType =
  | "retrieval_request"
  | "context_response"
  | "gap_request"
  | "conflict_notice"
  | "provenance_request"
  | "cache_hit"
  | "cache_miss"
  | "final_context"
  | "other";

export interface JevRetrievalIntent {
  purpose: string;
  query: string;
  interviewerRole?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  technicalDepth?: 1 | 2 | 3 | 4 | 5;
  answerMaturity?: 1 | 2 | 3 | 4 | 5;
  requestedSources?: string[];
  knownModelId?: string;
  missingKnowledge?: string[];
  requireProvenance?: boolean;
}

export interface JevEvidence {
  sourceKey: string;
  sourceKind: string;
  sourceRef?: string;
  sourceVersion?: string;
  score?: number;
  selectionReason?: string;
  summary?: string;
  provenance: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export interface JevContextSnapshot {
  snapshotKey: string;
  sourceFingerprint?: string;
  evidence: JevEvidence[];
  conflicts: Array<{
    subject: string;
    versions: unknown[];
    explanation?: string;
  }>;
  missing: string[];
  provenanceManifest: Array<Record<string, unknown>>;
}

export interface InternalAgentDecision {
  enoughContext: boolean;
  followUpIntent?: JevRetrievalIntent;
  answerPlan?: Record<string, unknown>;
  reasoningScope?: Record<string, unknown>;
}

export const JEV_INTERNAL_AGENT_CONTRACT = {
  collaboration: "Jev + internal agent",
  exclusiveContextAssembly: false,
  loop: [
    "internal_agent_requests_context",
    "jev_resolves_ranks_and_provenances",
    "internal_agent_reasons_and_checks_gaps",
    "optional_targeted_jev_followup",
    "internal_agent_builds_answer_plan",
    "thomas_renders_first_person",
  ],
  jevResponsibilities: [
    "persistent_retrieval",
    "source_ranking",
    "source_scoping",
    "provenance",
    "conflict_surfacing",
    "cache_reuse",
    "context_snapshotting",
  ],
  internalAgentResponsibilities: [
    "question_understanding",
    "session_state_reasoning",
    "retrieval_intent_generation",
    "evidence_synthesis",
    "gap_detection",
    "followup_retrieval",
    "answer_planning",
  ],
  sourcePriority: [
    "kompas_model",
    "temporal_memory",
    "conversation",
    "artifact",
    "connected_app",
    "profile",
    "cache",
    "external_reference",
  ],
  guarantees: [
    "resume_and_jd_use_the_existing_unified_kompas_model",
    "candidate_evidence_precedes_generic_knowledge",
    "scenarios_never_become_candidate_history",
    "conflicts_are_returned_not_silently_flattened",
    "unchanged_sources_reuse_cached_context",
    "changed_sources_invalidate_only_affected_derivations",
  ],
} as const;

export function needsAnotherJevPass(decision: InternalAgentDecision) {
  return !decision.enoughContext && Boolean(decision.followUpIntent);
}
