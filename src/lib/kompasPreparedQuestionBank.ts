import { sameQuestionKey } from "./kompasQuestionKey.ts"

/** Only an exact same-question bank entry may supply a prepared-answer project hint. */
export function matchBank(
  q: string,
  questions: unknown,
): { q: string; projectId?: string } | null {
  if (!Array.isArray(questions) || !questions.length) return null
  let fallback: { q: string; projectId?: string } | null = null
  for (const raw of questions) {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
    const iq = String(item.q ?? "")
    if (!iq || !sameQuestionKey(q, iq)) continue
    const match = {
      q: iq,
      projectId: typeof item.projectId === "string" ? item.projectId : undefined,
    }
    if (String(q).trim().toLowerCase() === iq.trim().toLowerCase()) return match
    if (!fallback) fallback = match
  }
  return fallback
}
