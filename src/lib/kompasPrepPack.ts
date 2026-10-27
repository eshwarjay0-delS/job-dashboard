// Prevents a prep pack the model did write from being thrown away for its wrapping. The prep route parsed the reply with a
// bare JSON.parse, so a reply in ```json fences or after one line of prose failed the whole session's prep the same way a
// reply cut off at the token ceiling did, and the route said only "Prep failed". This reads the object out of the reply and,
// when there is none, says why (cut off, or no JSON at all), so the reason reaches the log.

import { allowedNumbers, needsGuard } from "../../src/lib/kompasGuards.ts"
import { resumeRoles } from "../../src/lib/kompasResume.ts"

export type PrepPackResult = { ok: true; pack: Record<string, unknown> } | { ok: false; reason: string }

export function parsePrepPack(text: string): PrepPackResult {
  const raw = String(text || "").trim()
  if (!raw) return { ok: false, reason: "empty reply" }
  const unfenced = raw.replace(/^```[a-z]*\s*\n?/i, "").replace(/\n?```\s*$/, "").trim()
  const start = unfenced.indexOf("{")
  if (start < 0) return { ok: false, reason: "no JSON object in the reply" }
  const end = unfenced.lastIndexOf("}")
  if (end < start) return { ok: false, reason: `reply cut off after ${raw.length} characters` }
  let pack: unknown
  try { pack = JSON.parse(unfenced.slice(start, end + 1)) }
  catch { return { ok: false, reason: `reply is not complete JSON (${raw.length} characters, likely cut off)` } }
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) return { ok: false, reason: "reply JSON is not an object" }
  if (!Array.isArray((pack as Record<string, unknown>).questions)) return { ok: false, reason: "reply has no questions list" }
  return { ok: true, pack: pack as Record<string, unknown> }
}

// What the route may say about a failure: a parse reason as written above, or a provider's name and HTTP status cut from
// its error ("OpenRouter API 429"). Never the provider's message body, which can echo the prompt.
export function prepFailureReason(e: unknown): string {
  const m = String((e as Error)?.message || e || "")
  const api = m.match(/^([A-Za-z]+ API \d{3})/)
  if (api) return api[1]
  if (/abort|timeout/i.test(m)) return "provider timed out"
  if (/^(empty reply|no JSON object|reply )/.test(m)) return m.slice(0, 120)
  if (/No API key/i.test(m)) return "no provider key"
  return "unexpected error"
}

// Holds the prep projects to the resume. Measured 27 Oct 2026 on the owner's Endpoint Analyst session: prep read only the
// resume's first 6,000 characters (summary and skills, none of the work history), so it wrote three projects with no
// employer and outcomes nobody wrote ("reducing endpoint policy violations by over 30%", "cutting mean time to detect by
// 40%", "200+ resources"), and answers reached for those projects out of the blue. A project now names the resume employer
// it happened at or is dropped, and a clause carrying a figure the resume does not state is cut from its outcome.
export type PrepProject = { id: string; name: string; employer: string; role: string; impact: string }

const plain = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/** The text without any clause that states a figure the resume does not; "" when the first clause already does. */
export function withoutUnsourcedFigures(text: string, allowed: Set<string>): string {
  const t = String(text || "").trim()
  if (!t || !needsGuard(t, allowed)) return t
  const parts = t.split(/,\s+/)
  const cut = parts.findIndex((x) => needsGuard(x, allowed))
  return cut > 0 ? parts.slice(0, cut).join(", ").replace(/[\s.;:,]*$/, ".") : ""
}

export function groundPrepProjects(projects: PrepProject[], resume: string): PrepProject[] {
  const employers = resumeRoles(resume).employers
  const allowed = allowedNumbers(resume)
  const out: PrepProject[] = []
  for (const p of projects) {
    const said = plain(p.employer)
    const employer = employers.find((e) => said && (plain(e) === said || plain(e).includes(said) || said.includes(plain(e)))) || ""
    if (!p.name || (employers.length && !employer)) continue
    out.push({ ...p, employer, impact: withoutUnsourcedFigures(p.impact, allowed) })
  }
  return out
}
