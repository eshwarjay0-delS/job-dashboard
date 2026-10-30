import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { normalizeItem, gateItem, BLUEPRINT_RULES } from "@/lib/dossierBlueprint"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/section — one question-bank section for the dossier builder.
// Ported from perfACT's /api/section. The frontend fans out one call per
// interviewer × difficulty × category (and per project for STAR/deep-dive),
// passing previously-seen questions as `avoid` so nothing repeats.
// Request: { config, prep, spec: { interviewer, difficulty, category, projectId? }, avoid: string[] }
// Response: { items: [{ q, a[], tier, category, interviewer, difficulty, projectId }], md? }
// Blueprint (29 Oct 2026): with spec.blueprint = true each item may also carry angles { direct, architect,
// brownfield }, ladder [q2, q3, q4] and failure (an accountability prompt). They are optional: an item without
// them keeps the old shape, and the renderer shows it as before. Blueprint items pass the dossier figure gate.

const NO_STORE = { "Cache-Control": "no-store" }

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-section:${user.id}`, { max: 40, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Nothing to build." }, { status: 400, headers: NO_STORE })
  }
  const spec = (body.spec && typeof body.spec === "object" ? body.spec : {}) as Record<string, unknown>
  const interviewer = str(spec.interviewer, 40) || "engineer"
  const difficulty = str(spec.difficulty, 40) || "standard"
  const category = str(spec.category, 80) || "technical"
  const projectId = str(spec.projectId, 40)
  const config = (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>
  const blueprint = spec.blueprint === true
  const avoid = Array.isArray(body.avoid) ? body.avoid.map((a) => str(a, 90)).filter(Boolean).slice(0, 25) : []

  const facts = [
    config.role ? `Role: ${str(config.role, 120)}` : "",
    config.resume ? `Resume:\n${str(config.resume, 4000)}` : "",
    config.jd ? `Job description:\n${str(config.jd, 1500)}` : "",
  ].filter(Boolean).join("\n\n")

  try {
    const keys = resolveKeys({})
    const { text } = await callLLM({
      keys, purpose: "kompas:section", tier: "light",
      system: blueprint
        ? `You write interview practice questions for a question bank. Return ONLY valid JSON: { "items": [ { "q": "question", "a": ["bullet 1", "bullet 2"], "tier": 0-4, "opener": "one speakable first-person sentence, only from the resume; if nothing supports it, write [ ___ confirm before the call: opener ]", "angles": { "direct": "the direct technical answer, first person", "architect": "tradeoffs, scale, failure modes", "brownfield": "what is already there and what I can change without breaking production" }, "ladder": ["2nd question", "3rd question", "4th question"], "failure": "the accountability prompt: it went wrong, what do I own and how do I prove the fix" } ] }. 6 questions. Grounded in the facts given; never invent employers or metrics.\n${BLUEPRINT_RULES}`
        : `You write interview practice questions for a question bank. Return ONLY valid JSON: { "items": [ { "q": "question", "a": ["bullet 1", "bullet 2"], "tier": 0-4 } ] }. 6 questions. Grounded in the facts given; never invent employers or metrics.`,
      user: [
        facts,
        `Audience: ${interviewer}. Difficulty: ${difficulty}. Category: ${category}.`,
        projectId ? `Tie STAR/deep-dive questions to project ${projectId}.` : "",
        avoid.length ? `Do NOT repeat or closely paraphrase these:\n${avoid.join("\n")}` : "",
      ].filter(Boolean).join("\n\n"),
      maxTokens: blueprint ? 4000 : 2000,
    })
    const data = JSON.parse(text) as { items?: unknown[] }
    const mapped = (Array.isArray(data.items) ? data.items : []).slice(0, 10).map((it) => {
      const o = (it || {}) as Record<string, unknown>
      return {
        q: str(o.q, 300),
        a: Array.isArray(o.a) ? o.a.map((a) => str(a, 300)).filter(Boolean).slice(0, 6) : [],
        tier: [0, 1, 2, 3, 4].includes(Number(o.tier)) ? Number(o.tier) : 2,
        category,
        interviewer,
        difficulty,
        projectId,
      }
    })
    const items = mapped.filter((it) => it.q)
    const out = blueprint
      ? (Array.isArray(data.items) ? data.items : []).slice(0, 10).map((raw, i) => ({ raw, it: mapped[i] })).filter((x) => x.it && x.it.q)
        .map(({ raw, it }) => gateItem(normalizeItem({ ...(raw as object), ...it }), [str(config.resume, 12000), str(config.jd, 6000), str(config.instructions, 3000)]).item)
      : items
    return NextResponse.json({ items: out }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ items: [] }, { headers: NO_STORE })
  }
}
