// Owner rule (30 Oct 2026): a resume file is never refused over missing job-post terms.
// A JD-terms rollback can restore the original paragraphs, which prevents unsupported
// claims but does not constitute a completed rewrite. Experience gaps must still block
// delivery, even when TAILOR_SHIP_ON_ROLLBACK is enabled.
// Import-free so the tests' vm loader can read it.
export function shipOnRollbackOn(env: Record<string, string | undefined> | undefined = globalThis.process?.env): boolean {
  const v = String(env?.TAILOR_SHIP_ON_ROLLBACK ?? "").trim().toLowerCase()
  return !(v === "0" || v === "false" || v === "off" || v === "no")
}

export type RoleBlockerInput = {
  splitDraft: boolean
  skillsOnly: boolean
  lackingRoleCount: number
  experienceComplete: boolean
  jdGate: boolean
  bulletsReverted: number
}

/** The role-level quality blockers; restoring original paragraphs never proves completion. */
export function roleQualityBlockers(i: RoleBlockerInput, env?: Record<string, string | undefined>): string[] {
  if (!i.splitDraft || i.skillsOnly) return []
  // A rollback restores original source paragraphs, but it does not complete the
  // requested experience rewrites. Never excuse missing roles or evidence gaps.
  // Keep the legacy switch available for compatibility; it cannot waive delivery safety.
  void env
  return [
    ...(i.lackingRoleCount > 0 ? ["roles_unrewritten"] : []),
    ...(!i.experienceComplete ? ["role_evidence_gaps"] : []),
  ]
}
