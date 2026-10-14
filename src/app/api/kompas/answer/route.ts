import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { callLLM, resolveKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { dossierContext } from "@/lib/dossier"
import { hashUserId } from "@/lib/sttLedger"
import {
  classify, lengthPlan, plainlyNoQuestion, cleanQuestion, resolveFollowUp,
  tierRule, pickShape, DERIVE_SYSTEM,
  normLedger, toLedgerProjects, pickProject, pickBottleneck, pickAngle,
  commit, matchBank,
} from "@/lib/kompasAnswer"
import { voiceRepair } from "@/lib/kompasVoiceRepair"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// POST /api/kompas/answer — MarketFit's native session answer engine (2026-10-14).
//
// The owner's directive: sessions run on OpenRouter, max priority. perfACT's
// Groq backend rate-limits mid-session AND answers the wrong question (a typed
// "intro" came back as a CodeQL dissertation instead of a self-introduction).
// This endpoint replaces that backend for MarketFit's Kompas page: one
// OpenRouter call generates the answer already balanced for a human listener,
// grounded in the speaker's real background. Nothing here touches Groq.
//
// Answering intelligence is ported from perfACT's interview engine
// (copilot/api/answer.js): question classification → per-tier rules,
// Parakeet-calibrated length planning, code-level follow-up resolution, and
// the three code gates for question detection — pivoted onto MarketFit's
// provider, dossier grounding and [beat]/[breath] pause architecture.

const NO_STORE = { "Cache-Control": "no-store" }

const SYSTEM = `You are answering a live interview question as the candidate's copilot. The candidate will speak your answer out loud, so write it the way a sharp practitioner talks — thinking out loud with the listener, never reciting a spec sheet.

DELIVERY (this is the balance — hold it on every answer):
- ANSWER FIRST: the first sentence carries the specific noun — the tool, setting, mechanism, decision or direct answer. Never open by restating the question, with framing, or with praise for the question.
- THINK OUT LOUD. Reason in front of the listener: "It depends on the system — I'm going to assume it's on a Windows server, just to make the example easy."
- CONCRETE OVER ABSTRACT. Real projects, named tools, settings, logs, steps — never abstractions alone.
- UNFOLD STEP BY STEP, one clear move at a time, with natural pause points.
- 60% human narration, 40% crisp technical. Each technical point said once, said well, inside the story.
- TALK WITH, NOT AT: "right?", "you know", "basically".
- STRUCTURAL PAUSES — write these markers into the text: [beat] (once or twice per answer, BEFORE the key insight the listener must remember), [breath] (between ideas/steps so the listener catches up). Never stack them, never open with one.
- PLAIN VERBS: use, fix, check — not utilize, remediate, validate. Never "stakeholders" (name the role), never "leveraged", never "great question".

SUBSTANCE:
- Ground EVERYTHING in the speaker's real background given below (identity, projects, prior answers). Prefer their actual projects and real outcomes over generic examples.
- EVIDENCE BEFORE STORYTELLING: the background establishes only the experience it states — never upgrade a resume bullet into an incident, a metric, an error message or a date it does not contain. Never invent employers, tools, or metrics.
- The depth level is set by who is asking (given below): tech-HR stays accessible, engineer is practitioner-deep, architect keeps system-design teeth, director stays strategic. Whatever the level, sound like a person reasoning, not a manual.
- HIT THE LENGTH TARGET below — a quick factual ask gets a short answer, a deep dive gets room. Length is the most audible quality signal.

Return only the answer, no preamble, no commentary.`

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-answer:${user.id}`, { max: 60, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400, headers: NO_STORE })
  }

  const keys = resolveKeys({})
  const uHash = hashUserId(user.id)
  let grounding = ""
  try { grounding = await dossierContext(uHash, "general") } catch { /* ungrounded answer is still an answer */ }

  // deriveOnly: the frontend asking "was that a question?" — cheapest first.
  // Gate 1 (code): speaker-aware — no Them: line and no ask pattern = no question.
  // Gate 2 (code): the transcript reduces to one clean question → extract verbatim.
  // Gate 3 (model): consolidated derivation with speaker labels.
  if (body.deriveOnly) {
    const transcript = str(body.transcript, 3000) || str(body.question, 500)
    if (!transcript || plainlyNoQuestion(transcript))
      return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    const clean = cleanQuestion(transcript)
    if (clean) return NextResponse.json({ derived: clean }, { headers: NO_STORE })
    try {
      const { text } = await callLLM({
        keys, purpose: "kompas:answer-derive", tier: "light",
        system: DERIVE_SYSTEM,
        user: `HEARD (everything said since the last answer):\n${transcript}`,
        maxTokens: 150,
      })
      const derived = text.trim()
      if (!derived || /^NO_QUESTION/i.test(derived)) return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
      return NextResponse.json({ derived }, { headers: NO_STORE })
    } catch {
      return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    }
  }

  let question = str(body.derived, 500) || str(body.question, 500)
  if (!question) return NextResponse.json({ error: "Nothing to answer." }, { status: 400, headers: NO_STORE })

  const config = (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>
  const interviewer = str(config.interviewer, 40) || "engineer"
  const prep = (body.prep && typeof body.prep === "object" ? body.prep : {}) as Record<string, unknown>
  const transcript = str(body.transcript, 4000)
  const historyArr = Array.isArray(body.history) ? body.history : []
  const history = historyArr.slice(-4).map((h) => {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>
    return `Q: ${str(o.q ?? o.question, 200)}\nA: ${str(o.a ?? o.answer ?? o.text, 400)}`
  }).filter(Boolean).join("\n\n")
  const retrieved = Array.isArray(body.retrieved) ? body.retrieved.slice(0, 4).map((r) => str(r, 300)).filter(Boolean).join("\n") : ""

  // perfACT's answering intelligence: classify → tier rule → length plan.
  // A topic-less follow-up ("go deeper") is glued to the previous question in code.
  question = resolveFollowUp(question, historyArr.map((h) => {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>
    return { q: str(o.q ?? o.question, 300) }
  }))
  const { tier, why } = classify(question)
  const plan = lengthPlan(tier, question, interviewer, {
    difficulty: str(config.difficulty, 20) || undefined,
    length: str(config.length, 20) || undefined,
  })
  const rule = tierRule(tier, interviewer)
  // 27 question archetypes (perfACT _shapes.js): first-win structural instruction.
  const shape = pickShape(question, tier, grounding + " " + str(prep.projects, 2000))
  // perfACT's rotation ledger (client-carried): the frontend sends its ledger
  // with every turn and stores the one returned, so a session never retells
  // the same story, bottleneck or angle. Route this question to a project by
  // term overlap + least-recently-used, preferring an untold story for STAR.
  const ledger = normLedger(body.ledger)
  const ledgerProjects = toLedgerProjects(prep.projects)
  const banked = matchBank(question, prep.questions)
  let projectId: string | null = null
  let bott = ""
  let angle = ""
  if (tier !== 0 && ledgerProjects.length) {
    const routed = pickProject(question, tier, ledger, ledgerProjects, banked?.projectId)
    projectId = routed.id
    const project = ledgerProjects.find((p) => p.id === routed.id) || null
    bott = pickBottleneck(project, ledger)
    angle = pickAngle(ledger)
    commit(ledger, routed.id, angle, bott, tier)
  }
  const routedProject = projectId ? ledgerProjects.find((p) => p.id === projectId) || null : null
  const toldNames = Object.keys(ledger.story)
    .filter((k) => k !== projectId)
    .map((k) => ledgerProjects.find((p) => p.id === k)?.title || k)
    .filter(Boolean)

  const context = [
    `The interviewer is a ${interviewer} — pitch the technical depth to them.`,
    `QUESTION TYPE: ${why} (tier ${tier}). ${rule}`,
    shape ? `ANSWER SHAPE (follow this structure): ${shape}` : "",
    `LENGTH TARGET: about ${plan.words} spoken words (${plan.secs[0]}-${plan.secs[1]} seconds). Hit it — a quick factual ask gets a short answer, a deep dive gets room.`,
    tier !== 0 && routedProject
      ? `Tell this answer from inside THIS project: ${routedProject.title}${routedProject.employer ? ` (${routedProject.employer})` : ""}. Do not switch projects mid-answer.`
      : "",
    bott ? `Center the story on this concrete bottleneck: ${bott}.` : "",
    angle && tier !== 0 && plan.kind !== "code" ? `Fresh angle for this telling: ${angle}.` : "",
    tier !== 0 && tier !== 3 && toldNames.length
      ? `Stories already told this session — do not retell them: ${toldNames.join("; ")}.`
      : "",
    prep.identity ? `Candidate identity: ${str(prep.identity, 800)}` : "",
    prep.persona ? `Persona: ${str(prep.persona, 800)}` : "",
    prep.projects ? `Candidate's real projects: ${str(prep.projects, 2000)}` : "",
    grounding ? `Real background (prefer over generic examples):\n${grounding.slice(0, 3000)}` : "",
    transcript ? `Conversation so far:\n${transcript}` : "",
    history ? `Earlier in this interview:\n${history}` : "",
    retrieved ? `Retrieved notes:\n${retrieved}` : "",
  ].filter(Boolean).join("\n\n")

  try {
    const { text, provider, model } = await callLLM({
      keys, purpose: "kompas:answer", tier: "heavy",
      system: SYSTEM,
      user: `${context}\n\nThe interviewer asked: "${question}"\n\nAnswer it as the candidate's spoken reply:`,
      maxTokens: plan.maxTokens,
    })
    const out = voiceRepair(text.trim())
    if (!out) throw new Error("empty answer")
    return NextResponse.json({
      text: out,
      polished: true,
      ledger,
      meta: { engine: "marketfit", provider, model, interviewer, tier, kind: plan.kind, words: plan.words, routed: projectId },
    }, { headers: NO_STORE })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "answer failed"
    return NextResponse.json({ error: "The answer engine is unavailable right now. Try again in a moment.", detail: msg, meta: { engine: "marketfit", failed: true } }, { status: 503, headers: NO_STORE })
  }
}
