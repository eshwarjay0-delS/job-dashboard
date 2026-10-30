import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { getDossierSessions } from "@/lib/dossier"
import { hashUserId } from "@/lib/sttLedger"
import * as kompasAudience from "@/lib/kompasAudience"
import { BLUEPRINT_GUIDE, BLUEPRINT_RULES, gateFigures, stripContact, holesIn, type BlueprintPart } from "@/lib/dossierBlueprint"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/persona — background persona-file builder (the dossier).
// Ported from perfACT's /api/persona. The frontend fans out one call per part
// (cover, who, projects, moments, domain, tools, qbank, call) and stitches the
// returned markdown ("### " units) into the persona file in IndexedDB.
// Request: { config, prep, part, projectIds?, projectOffset?, batch?, total?, interviewer }
// Response: { lane, md?, done? } — md holds the markdown for this part.
// Blueprint parts (29 Oct 2026, research/dossier-blueprint.md): evidence, oneminute, signals, fixfirst, ladder,
// jargon. They also read config.instructions / body.expectations (the expectations narrative) and body.transcript,
// fixfirst reads the user's saved sessions (read only), and every figure they return passes the dossier gate:
// a number the sources do not state comes back as a marked hole, never a guess. Response adds blocked[] and holes[].
// The existing parts above are unchanged.

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

  const blueprint = (Object.prototype.hasOwnProperty.call(BLUEPRINT_GUIDE, part) ? part : "") as BlueprintPart | ""
  if (blueprint) return blueprintPart(blueprint, user.id, interviewer, body, config, prep, facts)

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

// Voice rules come from the Lens bot's blocks in kompasAudience (REALISM / LENS) once they ship; the dossier
// engine does not write its own. Until then only the existing EVIDENCE_POLICY applies.
function lensBlocks(): string {
  const a = kompasAudience as unknown as Record<string, unknown>
  return ["EVIDENCE_POLICY", "REALISM", "LENS"].map((k) => (typeof a[k] === "string" ? (a[k] as string) : "")).filter(Boolean).join("\n\n")
}

async function blueprintPart(
  part: BlueprintPart, userId: string, interviewer: string, body: Record<string, unknown>,
  config: Record<string, unknown>, prep: Record<string, unknown>, facts: string,
) {
  const expectations = str(body.expectations, 3000) || str(config.instructions, 3000)
  const transcript = str(body.transcript, 6000)
  let sessions = ""
  if (part === "fixfirst" || part === "ladder") {
    const list = await getDossierSessions(hashUserId(userId), 5).catch(() => [])
    sessions = list.flatMap((x) => x.qa.slice(0, 12).map((qa) => `Q: ${qa.q.slice(0, 200)}\nA: ${qa.a.slice(0, 400)}`)).join("\n").slice(0, 6000)
  }
  const sources = [str(config.resume, 12000), str(config.jd, 6000), expectations, transcript, sessions, str(prep.projects, 2000)]
  const user = [
    facts,
    expectations ? `Expectations / recruiter or manager notes:\n${expectations}` : "",
    transcript ? `Earlier round transcript:\n${transcript}` : "",
    sessions ? `Earlier Kompas sessions (what was actually said; earlier AI answers are not evidence):\n${sessions}` : "",
    `Write the "${part}" section. ${BLUEPRINT_GUIDE[part]}`,
  ].filter(Boolean).join("\n\n")
  try {
    const keys = resolveKeys({})
    const { text, provider } = await callLLM({
      keys, purpose: `kompas:persona:${part}`, tier: "heavy",
      system: [`You write one section of a candidate's interview dossier, in markdown. Use "### " headings for each unit. Write for a ${interviewer} audience.`, BLUEPRINT_RULES, lensBlocks()].filter(Boolean).join("\n\n"),
      user, maxTokens: 1600,
    })
    const gated = gateFigures(stripContact(text.trim()), sources)
    return NextResponse.json({ lane: provider, md: gated.text, done: true, blocked: gated.blocked, holes: holesIn(gated.text).length }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ lane: "none" }, { headers: NO_STORE })
  }
}
