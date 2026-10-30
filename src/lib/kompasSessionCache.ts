/**
 * Speed r6 (29 Oct 2026): per-session cache for what the answer path derived from the same resume and documents on every
 * question (resume roles, speakable facts, allowed-numbers list, the fitted resume digest). Keyed by a SHA-256 of the
 * exact inputs, so any change to the resume or documents is a new key (invalidation by content). Bounded LRU in instance
 * memory. Failsafe: empty inputs are computed directly and never cached; any cache error computes directly, as today.
 * The allowed-numbers Set is copied on every read so no caller can add a figure to the shared list.
 */
import { createHash } from "node:crypto"
import { allowedNumbers, speakFacts, type SpeakFacts } from "./kompasGuards.ts"
import { resumeDigest, resumeRoles, type ResumeRoles } from "./kompasResume.ts"

export const SESSION_CACHE_MAX = 64
interface Facts { roles: ResumeRoles; guardFacts: SpeakFacts; allowed: Set<string> }
const facts = new Map<string, Facts>()
const digests = new Map<string, string>()
let builds = 0

const keyOf = (...parts: string[]) => {
  const h = createHash("sha256")
  for (const p of parts) h.update(`${p.length}\u0000${p}\u0001`)
  return h.digest("hex")
}
function touch<V>(m: Map<string, V>, k: string, v: V): V {
  m.delete(k); m.set(k, v)
  while (m.size > SESSION_CACHE_MAX) m.delete(m.keys().next().value as string)
  return v
}
function build(resume: string, documents: string): Facts {
  builds++
  return {
    roles: resumeRoles(resume),
    guardFacts: speakFacts({ resume, jd: "", documents, heard: "", identity: "", projects: "" }),
    allowed: allowedNumbers(resume, documents),
  }
}
const copy = (f: Facts): Facts => ({ roles: f.roles, guardFacts: { ...f.guardFacts }, allowed: new Set(f.allowed) })

/** Resume roles, speakable facts and the allowed-numbers list for these sources, built once per content. */
export function sessionFacts(resume: string, documents: string): Facts {
  const r = String(resume || ""), d = String(documents || "")
  if (!r && !d) return build(r, d)
  try {
    const k = keyOf("facts", r, d)
    const hit = facts.get(k)
    return copy(hit ? touch(facts, k, hit) : touch(facts, k, build(r, d)))
  } catch { return build(r, d) }
}

/** resumeDigest, memoised by (resume, question, budget, mode): the same ask in another mode or a re-ask reuses it. */
export function cachedDigest(resume: string, ask: string, budget: number, mode: "focused" | "career"): string {
  if (!resume) return resumeDigest(resume, ask, budget, mode)
  try {
    const k = keyOf("digest", resume, ask, String(budget), mode)
    const hit = digests.get(k)
    return hit !== undefined ? touch(digests, k, hit) : touch(digests, k, resumeDigest(resume, ask, budget, mode))
  } catch { return resumeDigest(resume, ask, budget, mode) }
}

export function sessionCacheStats() { return { builds, entries: facts.size, digests: digests.size } }
export function clearSessionCache() { facts.clear(); digests.clear() }
