// Owner rule (30 Oct 2026): a resume file is never refused over missing job-post terms.
// With the job-post terms gate on, the rollback in tailor.ts puts back the candidate's original paragraph for any
// rewrite that used a job-post-only term. Those roles are the candidate's own record, not an unfinished draft, so
// they no longer count as roles_unrewritten / role_evidence_gaps. The file then goes out with the existing
// "Below the 95% target... Still missing" label. TAILOR_SHIP_ON_ROLLBACK=0 restores the old refusal.
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

/** The role-level quality blockers. Rollback-caused gaps are excused only when the gate restored paragraphs. */
export function roleQualityBlockers(i: RoleBlockerInput, env?: Record<string, string | undefined>): string[] {
  if (!i.splitDraft || i.skillsOnly) return []
  const excused = i.jdGate && i.bulletsReverted > 0 && shipOnRollbackOn(env ?? globalThis.process?.env)
  if (excused) return []
  return [
    ...(i.lackingRoleCount > 0 ? ["roles_unrewritten"] : []),
    ...(!i.experienceComplete ? ["role_evidence_gaps"] : []),
  ]
}
