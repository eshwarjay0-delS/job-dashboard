// Repair bookkeeping, kept pure so it is tested without a model. The service (kompasAnswerService.repairStructure)
// calls the rewrite; this file decides whether a rewrite is kept and reports what happened, so a repair that landed
// and was later cut is visible in the done event instead of hiding behind "repaired: 0".

export type RepairStatus = "not-needed" | "advisory" | "no-key" | "landed" | "partial" | "discarded" | "failed"

export interface RepairOutcome {
  status: RepairStatus
  attempts: number
  missing: string[]
  stillMissing: string[]
  // Set after the answer is settled (voice repair, fact-check, ceiling trim): did the fixed items stay fixed?
  survived?: boolean
  lostAfterSettle?: string[]
}

/**
 * Keep a rewrite when it fixes at least one core item (structure or a named term) and breaks no core item that
 * was fine before. With no core items, the same rule runs on the advisory items. Returns how many were fixed.
 */
export function judgeRewrite(coreBefore: string[], coreAfter: string[], allBefore: string[], allAfter: string[]): number {
  const before = coreBefore.length ? coreBefore : allBefore
  const after = coreBefore.length ? coreAfter : allAfter
  if (!after.every((item) => before.includes(item))) return 0
  return Math.max(0, before.length - after.length)
}

export function statusFor(fixed: number, total: number, remaining: number): RepairStatus {
  if (!fixed) return "discarded"
  return remaining > 0 && fixed < total ? "partial" : "landed"
}

/** After settling: items the repair had fixed that are missing again in the answer the candidate actually sees. */
export function lostAfterSettle(outcome: RepairOutcome, finalMissing: string[]): string[] {
  if (outcome.status !== "landed" && outcome.status !== "partial") return []
  const fixed = outcome.missing.filter((item) => !outcome.stillMissing.includes(item))
  return fixed.filter((item) => finalMissing.includes(item))
}

export function repairLogLine(outcome: RepairOutcome, question: string): string {
  const q = String(question || "").slice(0, 80)
  const lost = outcome.lostAfterSettle?.length ? ` lost-after-settle=${outcome.lostAfterSettle.length}` : ""
  return `[kompas repair] ${outcome.status} attempts=${outcome.attempts} missing=${outcome.missing.length} still=${outcome.stillMissing.length}${lost} q="${q}"`
}

// ---- The repair loop itself, with the model call injected (29 Oct 2026). kompasAnswerService.repairStructure passes
// the OpenRouter call; scripts/kompas-repair-harness.mjs passes recorded model outputs, so the loop's rules are tested
// without a model: at most MAX_REPAIR_ATTEMPTS calls, each rewrites the best answer so far, a rewrite is kept only when
// judgeRewrite says it is better, provider-error text and blanked rewrites are skipped, and the original stands otherwise.
export const MAX_REPAIR_ATTEMPTS = 2

export interface RepairChecks { core: string[]; all: string[] }
export interface RepairLoopDeps {
  checks: (text: string) => RepairChecks
  rewrite: (best: string, missing: string[], attempt: number) => Promise<string>
  guard?: (text: string) => string
  isProviderError?: (text: string) => boolean
  hasKey?: boolean
  // Speed r6: when true, the model is called only for a real gap (repairNeedsModel); advisory-only items are reported
  // with status "advisory" and the original stands. Unset keeps the old behaviour exactly.
  gateAdvisory?: boolean
}

// Speed r6 (29 Oct 2026): a real gap is a core item (missing structure, a named term, a repeated or third-person answer,
// an unsupported source claim) or a part the interviewer explicitly asked for. An unasked-tangent note alone is advisory:
// it no longer costs a blocking model call. Failsafe: anything not recognised as advisory counts as a real gap.
const ADVISORY = /^remove the unasked technical tangent /
export function repairNeedsModel(checks: RepairChecks | null | undefined): boolean {
  if (!checks) return false
  if (Array.isArray(checks.core) && checks.core.length) return true
  return (Array.isArray(checks.all) ? checks.all : []).some((item) => !ADVISORY.test(String(item)))
}
export interface RepairLoopResult { text: string; repaired: number; repair: RepairOutcome }

export async function runRepairLoop(original: string, deps: RepairLoopDeps): Promise<RepairLoopResult> {
  const first = deps.checks(original)
  const missing = first.all
  if (!missing.length) return { text: original, repaired: 0, repair: { status: "not-needed", attempts: 0, missing: [], stillMissing: [] } }
  if (deps.gateAdvisory && !repairNeedsModel(first)) return { text: original, repaired: 0, repair: { status: "advisory", attempts: 0, missing, stillMissing: missing } }
  if (deps.hasKey === false) return { text: original, repaired: 0, repair: { status: "no-key", attempts: 0, missing, stillMissing: missing } }
  let best = { text: original, core: first.core, all: first.all }
  let attempts = 0
  let failed = false
  for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS && best.all.length; attempt++) {
    attempts++
    try {
      const rewrite = String((await deps.rewrite(best.text, best.all, attempt)) || "").trim()
      if (!rewrite || deps.isProviderError?.(rewrite)) continue
      const guarded = deps.guard ? deps.guard(rewrite) : rewrite
      if (!guarded.trim()) continue
      const after = deps.checks(guarded)
      if (judgeRewrite(best.core, after.core, best.all, after.all) > 0) best = { text: guarded, core: after.core, all: after.all }
    } catch { failed = true; break }
  }
  const fixed = missing.length - best.all.length
  const status = best.text === original ? (failed && attempts === 1 ? "failed" : "discarded") : statusFor(fixed, missing.length, best.all.length)
  return { text: best.text, repaired: best.text === original ? 0 : 1, repair: { status, attempts, missing, stillMissing: best.all } }
}

// r4 (item 24): the rewrite was told to ADD the missing part (system prompt) and to add NO unsupported claim (source
// check), but it never saw the candidate's sources, so the added part was invented, failed the source check and the
// repair was discarded. With sources, the prompt now carries the source lines and says which rule wins. With no sources
// the prompt is exactly the old one.
export function repairSourceRule(sourceBlock: string): string {
  const src = String(sourceBlock || "").trim()
  if (!src) return ""
  return `${src}\n\nRULE: Adding a missing part is completing the answer, not a new claim. Write each missing part from only the SOURCES lines above; when they do not cover it, say it in general terms ("I would…") with no new employer, tool, date or number. `
}
export function repairUserPrompt(question: string, best: string, missing: string[], sourceBlock: string): string {
  return `QUESTION: ${question}\n\nANSWER:\n${best}\n\nMISSING:\n${missing.map((m) => `- ${m}`).join("\n")}\n\n${repairSourceRule(sourceBlock)}The rewritten answer MUST contain each item above. Return the full rewritten answer and nothing else.`
}
