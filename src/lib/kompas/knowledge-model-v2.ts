export type KompasAudience =
  | "engineer"
  | "director"
  | "hiring_manager"
  | "recruiter"
  | "peer"
  | "mixed";

export type KompasNarrativeMode = "first_person" | "study" | "reference";

export type KompasKnowledgeNodeType =
  | "keyword"
  | "technology"
  | "concept"
  | "requirement"
  | "responsibility"
  | "experience"
  | "project"
  | "claim"
  | "architecture"
  | "protocol"
  | "data_flow"
  | "attack_path"
  | "failure_mode"
  | "control"
  | "test"
  | "debugging"
  | "remediation"
  | "business_impact"
  | "tradeoff"
  | "metric"
  | "example"
  | "scenario"
  | "question"
  | "answer"
  | "followup"
  | "caveat"
  | "story"
  | "other";

export interface KompasSourceFingerprints {
  resume?: string;
  jd?: string;
  portfolio?: string;
  transcript?: string;
  research?: string;
  feedback?: string;
}

export interface KompasRenderProfile {
  interviewerRole: KompasAudience;
  difficulty: 1 | 2 | 3 | 4 | 5;
  technicalDepth: 1 | 2 | 3 | 4 | 5;
  answerMaturity: 1 | 2 | 3 | 4 | 5;
  narrativeMode: KompasNarrativeMode;
  rendererVersion: string;
}

export interface KompasKnowledgeModelIdentity {
  schemaVersion: number;
  sourceFingerprint: string;
  resumeFingerprint?: string;
  jdFingerprint?: string;
  modelKey: string;
}

export const THOMAS_RENDERER_VERSION = "thomas-v2";
export const KOMPAS_KNOWLEDGE_SCHEMA_VERSION = 2;

function stablePairs(value: Record<string, string | number | boolean | undefined>) {
  return Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => [key, String(item)] as const);
}

/**
 * Builds the deterministic material used by the caller's hash function.
 * The actual cryptographic hash stays at the boundary where the runtime
 * already owns WebCrypto or Node crypto.
 */
export function buildKnowledgeSourceMaterial(
  sources: KompasSourceFingerprints,
  schemaVersion = KOMPAS_KNOWLEDGE_SCHEMA_VERSION,
) {
  return JSON.stringify({
    schemaVersion,
    sources: stablePairs(sources),
  });
}

export function buildInterviewBundleKey(profile: KompasRenderProfile) {
  return stablePairs({
    interviewerRole: profile.interviewerRole,
    difficulty: profile.difficulty,
    technicalDepth: profile.technicalDepth,
    answerMaturity: profile.answerMaturity,
    narrativeMode: profile.narrativeMode,
    rendererVersion: profile.rendererVersion,
  })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export const THOMAS_KNOWLEDGE_CONTRACT = {
  mergeResumeAndJd: true,
  persistNormalizedKeywords: true,
  reuseUnchangedNodes: true,
  incrementalInvalidation: true,
  oneModelAcrossPdfPrepAndLiveSession: true,
  internalComprehensionDepth: 5,
  defaultNarrativeMode: "first_person" as const,
  defaultRendererVersion: THOMAS_RENDERER_VERSION,
  presentationLayers: {
    engineer: [
      "implementation",
      "architecture",
      "protocols",
      "data_flow",
      "failure_modes",
      "attack_paths",
      "tests",
      "debugging",
      "code_config",
      "remediation",
    ],
    director: [
      "business_impact",
      "risk_tradeoffs",
      "ownership",
      "prioritization",
      "metrics",
      "delivery_constraints",
      "cross_team_decisions",
      "strategic_consequences",
    ],
  },
  examples: "real_field_project_bottleneck",
  avoid: [
    "meta_interview_rules_as_primary_content",
    "toy_or_childish_analogies_in_interview_outputs",
    "generic_best_practice_without_system_context",
    "unsupported_candidate_history",
    "keyword_dump_without_relationships",
  ],
} as const;
