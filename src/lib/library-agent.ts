// The resume a job starts from, inside one email's library, picked by an AI agent (Gemini's free tier) with the code's
// pick beside it.
//
// Owner, 19 Oct 2026: "whenever some [AppSec] engineer JD was given ... it should go to the my file section and go to the
// [AppSec] engineer and grab that resume, then apply those changes to that resume ... first let it be an AI agent
// assisting it all the time. Thereafter, once everything was very consecutive and 100% consistent, then we'll move on to
// a code". So both pick every time: the agent's pick is used when it names a real candidate, the code's (rankFor, the
// one with the most of the job's keywords) otherwise, and every pick is logged with whether the two agreed. The
// agreement rate is what says when the code alone can take over (pickAgreement).

import { blob } from "@/lib/storage"
import { callLLM, type LlmKeys, type TokenUsage } from "@/lib/llm"
import type { Ranked } from "@/lib/library-pick"
import type { Uses } from "@/lib/resume-library"

/** `by`: the model that made the pick. */
export type AgentPick = { index: number; why: string; by?: string }

// Twelve resumes with fifteen keywords each: on 19 Oct 2026 Gemini's free tier took 13 s for a two-line question and
// gave no answer in 15 s for twenty resumes with thirty keywords each.
const MOST_SHOWN = 12
const KEYWORDS_SHOWN = 15
// Gemini is asked first; when it has not answered by then, Groq is asked too, and the first good answer is used.
const SECOND_AFTER_MS = 4_000
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** What the agent is shown: the job, then each resume with its folder, keywords and how often it was picked. */
export function agentPrompt(jd: string, ranked: Ranked[], uses: Uses = {}, relOf: (abs: string) => string = a => a): { system: string; user: string } {
  const system = `You pick which saved resume a job application should start from. Output ONLY minified JSON: {"pick":<number>,"why":"<one short sentence>"}.
Choose the resume whose kind of job (its folder) and keywords are closest to the job description. Prefer the folder that names the same kind of role. When two are equally close, prefer the one picked more often, then the newer one. The number must be one of the listed numbers.`
  const list = ranked.slice(0, MOST_SHOWN).map((r, i) => {
    const c = r.candidate, u = uses[relOf(c.path)]
    return `${i + 1}. folder: ${c.folder || "(the resume the person sent)"} | file: ${clip(c.name, 70)} | picked: ${u?.n || 0} times | shows ${r.shows} of ${r.of} job keywords | keywords: ${clip(c.keywords.slice(0, KEYWORDS_SHOWN).join(", "), 240)}`
  }).join("\n")
  return { system, user: `JOB DESCRIPTION:\n${jd.slice(0, 4000)}\n\nSAVED RESUMES:\n${list}\n\nReturn the JSON.` }
}

/** The agent's answer read back: a number that is one of those listed, or null. */
export function parseAgentPick(text: string, count: number): AgentPick | null {
  let t = String(text || "").trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim()
  const a = t.indexOf("{"), b = t.lastIndexOf("}")
  if (a < 0 || b <= a) return null
  t = t.slice(a, b + 1)
  try {
    const o = JSON.parse(t) as { pick?: unknown; why?: unknown }
    const n = Number(o.pick)
    if (!Number.isInteger(n) || n < 1 || n > Math.min(count, MOST_SHOWN)) return null
    return { index: n - 1, why: typeof o.why === "string" ? clip(o.why.trim(), 200) : "" }
  } catch { return null }
}

/** Ask the agent. Resolves to null on any failure or after `timeoutMs`: the code's pick then stands. */
export async function agentPick(opts: { keys: LlmKeys; jd: string; ranked: Ranked[]; uses?: Uses; relOf?: (abs: string) => string; timeoutMs?: number; usageSink?: TokenUsage[] }): Promise<AgentPick | null> {
  // One resume: there is nothing to choose, so no model is asked and no agreement is recorded (found in review).
  const models = (["gemini", "groq"] as const).filter(p => !!opts.keys[p])
  if (opts.ranked.length < 2 || !models.length) return null
  const { system, user } = agentPrompt(opts.jd, opts.ranked, opts.uses, opts.relOf)
  const ask = (p: "gemini" | "groq") => callLLM({ keys: { [p]: opts.keys[p] }, pref: p, tier: "light", system, user, maxTokens: 200, temperature: 0, usageSink: opts.usageSink, purpose: "resume-keywords" })
    .then(r => { const pick = parseAgentPick(r.text, opts.ranked.length); return pick ? { ...pick, by: r.model } : null }).catch(() => null)
  return new Promise<AgentPick | null>(resolve => {
    let left = models.length, done = false
    const finish = (v: AgentPick | null) => { if (!done && (v || --left === 0)) { done = true; resolve(v) } }
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null) } }, opts.timeoutMs ?? 15_000)
    models.forEach((p, i) => {
      const go = () => { if (!done) ask(p).then(v => { finish(v); if (done) clearTimeout(timer) }) ; else finish(null) }
      if (i === 0) go(); else setTimeout(go, SECOND_AFTER_MS)
    })
  })
}

export type PickLog = { at: number; job: string; email: string; agent: string | null; code: string | null; used: string; agree: boolean | null; why?: string; by?: string }
const logKey = (userId: string) => `library/picks/${String(userId).replace(/[^A-Za-z0-9_-]/g, "_")}.json`
const MOST_LOGGED = 300

/** One pick written down, newest last; the oldest go past MOST_LOGGED. Never fails the job it describes. */
export async function logPick(userId: string, entry: PickLog): Promise<void> {
  try {
    const raw = await blob.getText(logKey(userId))
    const had = raw ? (JSON.parse(raw) as PickLog[]) : []
    await blob.put(logKey(userId), JSON.stringify([...(Array.isArray(had) ? had : []), entry].slice(-MOST_LOGGED)))
  } catch { /* the log is for deciding later; the resume still goes out */ }
}

/** How often the agent and the code chose the same resume, over the picks where both chose. */
export async function pickAgreement(userId: string): Promise<{ picks: number; compared: number; agreed: number }> {
  try {
    const raw = await blob.getText(logKey(userId))
    const all = raw ? (JSON.parse(raw) as PickLog[]) : []
    const compared = all.filter(p => p.agree !== null && !!p.by)
    return { picks: all.length, compared: compared.length, agreed: compared.filter(p => p.agree).length }
  } catch { return { picks: 0, compared: 0, agreed: 0 } }
}
