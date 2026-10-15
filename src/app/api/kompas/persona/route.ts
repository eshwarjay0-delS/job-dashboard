import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/persona — background persona-file builder (the dossier).
// Ported from perfACT's /api/persona. The frontend fans out one call per part
// (cover, who, projects, moments, domain, tools, qbank, call) and stitches the
// returned markdown ("### " units) into the persona file in IndexedDB.
// Request: { config, prep, part, projectIds?, projectOffset?, batch?, total?, interviewer }
// Response: { lane, md?, done? } — md holds the markdown for this part.

const NO_STORE = { "Cache-Control": "no-store" }

const PART_GUIDE: Record<string, string> = {
  cover: "A one-paragraph cover: who this candidate is, in two sentences, for the top of the dossier.",
  who: "Who they are as a practitioner: background thread, years, current focus — a short section.",
  projects: "For each project: what it was, their role, what they owned, one concrete outcome. Grounded in FACTS only.",
  moments: "Key career moments: 3-5 short entries, each a moment that shaped how they work.",
  domain: "Domain depth: the areas they know cold, with one line of proof each from FACTS.",
  tools: "Tools and platforms: grouped list, each tied to where they used it.",
  qbank: "Likely interview questions for this candidate: 8, each with a one-line answer sketch.",
  call: "How they come across on a call: presence, pace, strengths to lean into.",
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-persona:${user.id}`, { max: 30, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Nothing to build." }, { status: 400, headers: NO_STORE })
  }
  const part = str(body.part, 40) || "cover"
  const interviewer = str(body.interviewer, 40) || "engineer"
  const config = (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>
  const prep = (body.prep && typeof body.prep === "object" ? body.prep : {}) as Record<string, unknown>

  const facts = [
    config.company ? `Company: ${str(config.company, 120)}` : "",
    config.role ? `Role: ${str(config.role, 120)}` : "",
    config.resume ? `Resume:\n${str(config.resume, 4000)}` : "",
    config.jd ? `Job description:\n${str(config.jd, 2000)}` : "",
    prep.identity ? `Identity: ${str(prep.identity, 800)}` : "",
    prep.projects ? `Projects: ${str(prep.projects, 2000)}` : "",
  ].filter(Boolean).join("\n\n")

  const guide = PART_GUIDE[part] || PART_GUIDE.cover

  try {
    const keys = resolveKeys({})
    const { text, provider } = await callLLM({
      keys, purpose: "kompas:persona", tier: "heavy",
      system: `You write one section of a candidate's interview dossier, in markdown. Use "### " headings for each unit. Be concrete and grounded in the FACTS below — never invent employers, tools, or metrics. Write for a ${interviewer} audience.`,
      user: `${facts}\n\nWrite the "${part}" section. ${guide}`,
      maxTokens: 1200,
    })
    return NextResponse.json({ lane: provider, md: text.trim(), done: true }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ lane: "none" }, { headers: NO_STORE })
  }
}
