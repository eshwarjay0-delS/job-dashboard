import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { groundPrepProjects, parsePrepPack, prepFailureReason, withoutUnsourcedFigures } from "@/lib/kompasPrepPack"
import { allowedNumbers } from "@/lib/kompasGuards"
import { resumeDigest } from "@/lib/kompasResume"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/prep — the prep pack: identity, persona, projects, core Q&A.
// Ported from perfACT's /api/prep. The frontend calls this once per session
// (body {config}) and retries in the background on failure, so a failure here
// is never fatal — but the pack must have v: 2 and an array pack.questions.
// Request: { config: { company, role, jd, resume, documents, instructions, language } }
// Response: { v: 2, identity, persona: { role }, projects: [{id,name,employer,role,impact}], questions: [{q, answer[], tier, group, projectId}] }

const NO_STORE = { "Cache-Control": "no-store" }

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-prep:${user.id}`, { max: 10, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Nothing to prepare." }, { status: 400, headers: NO_STORE })
  }
  const config = (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>

  const facts = [
    config.company ? `Company: ${str(config.company, 120)}` : "",
    config.role ? `Role: ${str(config.role, 120)}` : "",
    // Every role with the bullets this job asks about, not the first 6,000 characters: on a long resume those are the
    // summary and skills only, and prep invented the career (27 Oct 2026).
    config.resume ? `Resume:\n${resumeDigest(String(config.resume), `${str(config.role, 120)}\n${str(config.jd, 3000)}`, 9000)}` : "",
    config.jd ? `Job description:\n${str(config.jd, 3000)}` : "",
    config.documents ? `Documents:\n${str(config.documents, 2000)}` : "",
    config.instructions ? `Instructions:\n${str(config.instructions, 1000)}` : "",
  ].filter(Boolean).join("\n\n")
  if (!facts) return NextResponse.json({ error: "Nothing to prepare from." }, { status: 400, headers: NO_STORE })

  try {
    const keys = resolveKeys({})
    const { text } = await callLLM({
      keys, purpose: "kompas:prep", tier: "heavy",
      // Built while the person sets up, so it may take longer than a live answer: measured 26 Oct, the shared per-call
      // deadline cut prep off ("provider timed out") on half the evaluation chains. Under this route's 60 s maxDuration.
      timeoutMs: 50_000,
      system: `You build an interview prep pack for a candidate, from their resume and the job description. Return ONLY valid JSON, no markdown fences, no commentary. Shape:
{
  "identity": "2-3 sentence spoken identity: who they are, the total years exactly as the resume states them, the industries and employers across the whole career, current focus",
  "persona": { "role": "their current title" },
  "projects": [ { "id": "p1", "name": "short name", "employer": "the employer exactly as the ROLES line writes it", "role": "their title there", "impact": "one-line outcome in the resume's own words" } ],
  "questions": [ { "q": "the question", "answer": ["bullet 1", "bullet 2"], "tier": 0-4, "group": "core", "projectId": "p1 or empty" } ]
}
Rules: 10-14 questions covering intro (tier 0), experience/STAR (tier 1), design/scenario (tier 2), drill-down (tier 3), own-experience (tier 4). Answers are short bullet skeletons grounded ONLY in the facts given — never invent employers, tools, or metrics. Projects come from the resume's roles, 2-4 of them, each from one employer on the ROLES line, preferring the work this job description asks about. Never write a number (percent, count, time saved) that the resume does not state. A tool, platform or client named together with an employer must be one that employer's section of the resume lists.`,
      user: `${facts}\n\nBuild the prep pack.`,
      maxTokens: 4000,
    })
    const read = parsePrepPack(text)
    if (!read.ok) throw new Error(read.reason)
    const pack = read.pack
    const questions = (pack.questions as unknown[]).slice(0, 20).map((q) => {
      const o = (q || {}) as Record<string, unknown>
      return {
        q: str(o.q, 300),
        answer: Array.isArray(o.answer) ? o.answer.map((a) => str(a, 300)).filter(Boolean).slice(0, 8) : [],
        tier: [0, 1, 2, 3, 4].includes(Number(o.tier)) ? Number(o.tier) : 2,
        group: str(o.group, 40) || "core",
        projectId: str(o.projectId, 40),
      }
    }).filter((q) => q.q)
    const projects = Array.isArray(pack.projects) ? (pack.projects as unknown[]).slice(0, 6).map((p, i) => {
      const o = (p || {}) as Record<string, unknown>
      return { id: str(o.id, 40) || `p${i + 1}`, name: str(o.name, 120), employer: str(o.employer, 120), role: str(o.role, 120), impact: str(o.impact, 300) }
    }).filter((p) => p.name) : []
    const grounded = groundPrepProjects(projects, String(config.resume || ""))
    const figures = allowedNumbers(String(config.resume || ""), String(config.documents || ""))
    for (const q of questions) q.answer = q.answer.map((a) => withoutUnsourcedFigures(a, figures)).filter(Boolean)
    return NextResponse.json({
      v: 2,
      identity: str(pack.identity, 800),
      persona: { role: str((pack.persona as Record<string, unknown> | undefined)?.role, 120) },
      projects: grounded,
      questions,
    }, { headers: NO_STORE })
  } catch (e) {
    // The reason goes to the log and to the caller (no resume text, and of a provider's refusal only its name and status):
    // a cut-off reply and a refused provider looked the same before, "Prep failed" and nothing else.
    const reason = prepFailureReason(e)
    console.warn("[kompas:prep] failed:", reason)
    return NextResponse.json({ error: "Prep failed. The page retries automatically.", reason }, { status: 502, headers: NO_STORE })
  }
}
