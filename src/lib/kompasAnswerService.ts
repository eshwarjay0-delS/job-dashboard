import { NextRequest, NextResponse } from "next/server"
import { keysFor, resolveKeys, type LlmKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { dossierContext } from "@/lib/dossier"
import { resumeRoles, resumeDigest, employerAliases } from "@/lib/kompasResume"
import { hashUserId } from "@/lib/sttLedger"
import { scheduleLlmRecord } from "@/lib/llmLedger"
import {
  classify, canonicalQuestion, requestedParts, cutShort, lengthPlan, questionDepth, deriveByCode, questionForAnswer, DIRECTOR_OPENING,
  tierRule, pickShape, DERIVE_SYSTEM, INTRODUCTION_POLICY, INTRO_CAREER_SPINE, INTENT_BOUNDARY, PERSONAL_EXPERIENCE_POLICY, TECHNICAL_ANSWER_BOUNDARY, RESPONSE_CRAFT_POLICY, isPersonalEvidenceQuestion, type LengthPlan,
  answerLevel, questionRegister, levelGuidance, ANSWER_LEVEL_NAME, missingStructure, STRUCTURE_REPAIR_SYSTEM,
  normLedger, toLedgerProjects, pickProject, pickBottleneck, pickAngle,
  commit, recordAngle, matchBank,
} from "@/lib/kompasAnswer"
import { QUESTION_FIRST_POLICY, repeatQuestionGuidance } from "@/lib/kompasIntent"
import { voiceRepair } from "@/lib/kompasVoiceRepair"
import { formatInterviewHistory } from "@/lib/kompasHistory"
import { latestInterviewerAsk, precisionPrompt, questionCoverage, missingQuestionParts, questionParts, spokenQualityFlags, correctVerifiedPresentationErrors } from "@/lib/kompasInterviewPrecision"
import { focusPlan, focusPrompt, applyFocusBudget, tangentSignals, missingNamedQuestionTerms, interviewIntent } from "@/lib/kompasRelevance"
import { rediscoverRelevance, relevanceRecoveryPrompt } from "@/lib/kompasRelevanceRecovery"
import { answerStreamPolicy, releaseProvisionalDelta, mustEmitFinalReplacement, candidateEvidenceForVerification, type KompasStreamPolicy } from "@/lib/kompasStreamIntegrity"
import { blendPrompt, blendSpoken, readAloud } from "@/lib/kompasBlend"
import { audienceGuidance, EVIDENCE_POLICY, INTERVIEW } from "@/lib/kompasAudience"
import { desktopCraft, desktopResponsePolicy } from "@/lib/kompasDesktopResponse"
import {
  allowedNumbers, applyGuards, speakFacts, verifyAnswer,
  type SpeakFacts,
} from "@/lib/kompasGuards"


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
//
// Streaming (2026-10-14, perfACT sunset): with {stream:true} the route answers
// as Server-Sent Events so the first words land in a few hundred ms — the same
// event contract perfACT's frontend speaks (meta / delta / replace / wait /
// done). Multi-lane fallback: OpenRouter primary → OpenRouter fallback model →
// retry-with-exact-wait (the provider's own "try again in Xs") → a prepared
// answer. Never a 5xx on a live turn: every failure degrades to something the
// candidate can still say.

const NO_STORE = { "Cache-Control": "no-store" }
const PAID_MODEL = "openai/gpt-oss-120b"
// Every live answer goes to the OpenRouter host with the lowest latency for this model (owner, 27 Oct 2026: "processed
// super duper quick with almost no latency or lag all the time"). Measured the day before over 86 live answers with
// OpenRouter's default host choice: first words 2.7 s typical, 7.6 s for the slowest tenth, 15.4 s at worst.
const LIVE_ROUTING = { allow_fallbacks: true, sort: "latency" }
const OR_URL = "https://openrouter.ai/api/v1/chat/completions"
// OpenRouter holds the requested ceiling against the balance — keep it modest,
// mirroring src/lib/llm.ts.
const orCap = (maxTokens: number) => Math.min(maxTokens, Number(process.env.OPENROUTER_MAX_TOKENS) || 2048)
// A model on a long rate-limit block is skipped by later requests on this
// warm instance instead of re-hitting the wall (perfACT's groqBlockedUntil).
const blockedUntil = new Map<string, number>()
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// "try again in 2.4s" / "577ms" / "11m19.2s" / "1h2m3s" → milliseconds.
// Ported from perfACT copilot-api/answer.js (retryMs).
function retryMs(t: string): number {
  const m = String(t || "").match(/try again in ((?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+(?:ms|s))?)/i)
  if (!m || !m[1]) return 0
  const g = (re: RegExp) => { const x = m[1].match(re); return x ? parseFloat(x[1]) : 0 }
  return g(/(\d+)h/) * 3600e3 + g(/(\d+)m(?!s)/) * 60e3 + (/ms$/i.test(m[1]) ? g(/([\d.]+)ms$/i) : g(/([\d.]+)s$/i) * 1000)
}
function isRateLimit(msg: string): boolean {
  return /\b429\b|rate.?limit|try again in|tokens per minute/i.test(msg || "")
}
const statusOf = (msg: string): number | undefined => {
  const m = /openrouter (\d{3})/.exec(msg || "")
  return m ? Number(m[1]) : undefined
}
const shortModel = (m: string) => m.split("/").pop() || m

// One lane's deadline: the client's own abort (a superseded card) plus a hard
// ceiling, so a hung provider can never eat the whole serverless budget.
function laneSignal(req: NextRequest, ms: number): { signal: AbortSignal; cleanup: () => void } {
  const c = new AbortController()
  const t = setTimeout(() => { try { c.abort(new Error("lane timeout")) } catch {} }, ms)
  const onAbort = () => { clearTimeout(t); try { c.abort() } catch {} }
  req.signal.addEventListener("abort", onAbort, { once: true })
  return { signal: c.signal, cleanup: () => { clearTimeout(t); req.signal.removeEventListener("abort", onAbort) } }
}

function reasoningFor(model: string): Record<string, unknown> {
  // Measured 2026-10-05 on nemotron-3-super: with reasoning on, a short rewrite
  // spent most of its tokens reasoning and took 6.5s; with it off, 0.6s.
  // Everything else gets reasoning_effort low — first words fast.
  return /nemotron/i.test(model) ? { reasoning: { enabled: false } } : { reasoning: { effort: "low" } }
}

function orError(res: Response, bodyText: string, model: string): Error {
  const retryAfter = Number(res.headers.get("retry-after") || "")
  const ms = retryMs(bodyText) || (retryAfter > 0 ? retryAfter * 1000 : 0)
  if (res.status === 429 && ms > 15000) blockedUntil.set(model, Date.now() + ms)
  return new Error(`openrouter ${res.status}${ms ? ` try again in ${Math.round(ms)}ms` : ""} ${bodyText.slice(0, 160)}`)
}

// Pump an OpenRouter SSE body into deltas (perfACT's readSSE, ported).
async function pumpSSE(body: ReadableStream<Uint8Array>, onData: (j: { error?: { code?: number }; choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>; usage?: { prompt_tokens?: number; completion_tokens?: number } }) => void): Promise<void> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") return
      try { onData(JSON.parse(data)) } catch { /* a partial frame: the next chunk completes it */ }
    }
  }
}

async function streamOpenRouter(
  key: string, model: string, system: string, user: string, maxTokens: number,
  onDelta: (d: string) => void, signal: AbortSignal,
): Promise<{ input: number; output: number; finish: string }> {
  if ((blockedUntil.get(model) || 0) > Date.now())
    throw new Error(`openrouter 429 try again in ${blockedUntil.get(model)! - Date.now()}ms (blocked)`)
  const res = await fetch(OR_URL, {
    method: "POST", signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "MarketFit" },
    body: JSON.stringify({
      model, provider: LIVE_ROUTING, max_tokens: orCap(maxTokens), stream: true,
      stream_options: { include_usage: true },
      ...reasoningFor(model),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!res.ok || !res.body) throw orError(res, await res.text().catch(() => ""), model)
  let input = 0, output = 0, failure = 0, finished = false, received = false, finish = ""
  await pumpSSE(res.body, (j) => {
    if (j.error) failure = Number(j.error.code) || 502
    if (j.choices?.[0]?.finish_reason) { finished = true; finish = String(j.choices[0].finish_reason) }
    const d = j.choices?.[0]?.delta?.content
    if (typeof d === "string" && d) { received = true; onDelta(d) }
    if (j.usage) { input = j.usage.prompt_tokens || 0; output = j.usage.completion_tokens || 0 }
  })
  if (failure || !received || !finished) throw new Error(`openrouter ${failure || 502} incomplete stream`)
  return { input, output, finish }
}

async function fetchOpenRouter(
  key: string, model: string, system: string, user: string, maxTokens: number, signal: AbortSignal,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  if ((blockedUntil.get(model) || 0) > Date.now())
    throw new Error(`openrouter 429 try again in ${blockedUntil.get(model)! - Date.now()}ms (blocked)`)
  const res = await fetch(OR_URL, {
    method: "POST", signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "MarketFit" },
    body: JSON.stringify({
      model, provider: LIVE_ROUTING, max_tokens: orCap(maxTokens),
      ...reasoningFor(model),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!res.ok) throw orError(res, await res.text().catch(() => ""), model)
  const data = await res.json()
  if (data.error) throw new Error(`openrouter ${Number(data.error.code) || 502}`)
  if (!data.choices?.[0]?.message?.content?.trim()) throw new Error("openrouter 502 empty response")
  const u = data.usage || {}
  return { text: data.choices?.[0]?.message?.content || "", usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0 } }
}

// A light non-streaming call for the post-generation fact-check (perfACT's
// verifyAnswer). JSON-forced, low effort, never streamed to the client.
async function verifyGenerate(key: string, system: string, user: string, signal: AbortSignal): Promise<string> {
  const model = PAID_MODEL
  const res = await fetch(OR_URL, {
    method: "POST", signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "MarketFit" },
    body: JSON.stringify({
      model: PAID_MODEL, provider: LIVE_ROUTING, max_tokens: 1600, temperature: 0,
      response_format: { type: "json_object" },
      ...reasoningFor(model),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!res.ok) throw new Error(`verify ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ""
}

const SYSTEM = `You are answering a live interview question as the candidate's copilot. The candidate will speak your answer out loud, so write it the way a sharp practitioner talks — thinking out loud with the listener, never reciting a spec sheet.

DELIVERY (this is the balance — hold it on every answer):
- ANSWER FIRST: sentence one is the answer in words this listener already has — the decision, the difference, or the check. A product name belongs there only when the question used it. The precise name comes next, in the same breath as what it does. Never open by restating the question, with framing, or with praise for the question.
- REASON WHEN REQUESTED: For a troubleshooting, design or decision question, explain the one condition that drives your next step. Do not introduce a Windows server or any assumed environment in unrelated questions.
- CONCRETE OVER ABSTRACT. Explain a specific mechanism and example. Personal projects and observed logs require original supporting evidence; otherwise use a clearly hypothetical example.
- SEQUENCE ONLY WHEN ASKED: Walk through steps for a process, incident or troubleshooting question. For a comparison, introduction, short yes/no, or closing, give a direct conversational response instead.
- RELEVANCE OVER TECHNICAL QUOTA: There is no required percentage of jargon or mechanisms. Each term must earn its place by answering the current question.
- TECHNICAL PRECISION: explain the condition being checked, the action taken, and how success is tested. Name a version only if supported by original source material and relevant to the question. Plain language can be exact; product names alone are not depth.
- MEASUREMENTS ONLY WITH SOURCE SUPPORT: Never invent a precise count, improvement, timeline, or business result. When facts lack a number, speak naturally without inventing a quantitative example.
- TALK WITH, NOT AT: natural connected sentences. Do not manufacture filler such as "right?", "you know", or "basically".
- SPOKEN DELIVERY: use natural punctuation and short connected sentences instead of [beat], [breath], double-underscore emphasis, or stage directions. They can leak into the spoken output.
- PLAIN, EXACT LANGUAGE: prefer clear verbs, but never avoid an exact term the interviewer explicitly used. In a control-risk discussion, remediation, root cause, residual risk, validation and control ownership are useful terms when they answer the question. Avoid empty jargon and generic role labels; never open with "great question".

CLARITY (the standard for every answer — nothing abstract, unfinished or unclear, ever):
- MIRROR, LIKE CLEAR RIVER WATER: reflect this interviewer's own world back to them — their vocabulary, their priorities, the question behind their question — clean, still and easy to see through. One clear line of thought per paragraph, in a natural order. No tangents, no needless hedging, no stacked qualifiers. State a real uncertainty plainly; confidence never turns an assumption into an observation.
- THE QUESTION'S OWN SUBJECT FIRST: if it names a thing (an alert, a playbook, a control, an outage), every paragraph deals with that thing. Never swap in a nearby topic you know better. Two parts are finished one after the other, not woven.
- EVERY PART ANSWERED: when the question asks two things, answer each one by name. "Who do you tell" is answered with a role (the incident commander, my director), not "the stakeholders".
- A SCENARIO IS A DESIGN: when the question sets a condition ("suppose", "tonight", "if"), answer with what you would do, in order — "I would…", "my first check is…". Past work appears only as one sentence of proof from the background.
- A REQUIREMENT IS A CONSTRAINT, not a trade-off: if the question says a path must stay rare or controlled, keep that requirement in every sentence.
- CONCRETE, NEVER INVENTED: name the tool, setting, log, step or result only when the background supplies it; otherwise describe the check conditionally. Never "various tools", "best practices", "etc." or "and so on".
- NARRATED: one thread. Do not open a second mechanism until the first one has landed. Each sentence names the thing we are still on, or says in a short clause how it follows the sentence before it. After a technical name, one clause says what it does here. A listener who blinked can rejoin from the next sentence. The last sentence returns to the question's subject. That bridge is not extra length, and it is not a First/Then/Finally script. While the sentence is forming, ask whether it is 100% relevant to this question. If it is not, do not say it. Presenting, articulation, and narration are the story: a plain line, one picture, the change, then the name once, in words a person can say in the meeting.
- LAYER: name the topic as surface or bottom, and stay there. Surface is a definition, a difference, a brief, or an overview: one picture, and a technical scenario that stops at what it was and what it changed. Bottom is only when they ask how, for a time, a failure, a bottleneck, or to go deeper: one technical scenario at that depth. A surface question never receives a bottom scenario.
- FINISHED: every point you open, you close. End on a complete, deliberate final sentence — never trail off, never stop mid-thought.
- CANDIDATE VOICE: "I"/"my"/"we" for supported experience, "I would" for a proposed approach. Never describe the answer, the candidate or the interviewer in the third person; never add notes about the answer.

SUBSTANCE:
- Ground personal claims in original resume and source documents. Generated identities, project summaries and prior answers are context, not independent evidence of personal experience.
- EVIDENCE BEFORE STORYTELLING: the background establishes only the experience it states — never upgrade a resume bullet into an incident, a metric, an error message or a date it does not contain. Never invent employers, tools, or metrics.
- The answering level is one of three (given below): Level 1 Technical Recruiter + Engineer stays clear and compressed, Level 2 Architect + Developer takes the full build depth, Level 3 Director carries the same understanding abstracted to decisions, metrics and business outcomes. The question's own register caps every level: a concept question (a definition, a comparison) is answered abstractly at all three. Whatever the level, sound like a person reasoning, not a manual. The most important thing is the diamond in the rough: a living edge, not a speech sanded smooth, clear enough that anyone in the room feels it. The interview still decides the question and the layer.
- HIT THE LENGTH TARGET below — a quick factual ask gets a short answer, a deep dive gets room. Length is the most audible quality signal.

Return only the answer, no preamble, no commentary.`

// ---- perfACT MODE_BLOCKS: interview mode detected per question, not per wizard ----
// coding beats everything (the question asks for code); a final-round interviewer
// (architect/director/lead/supervisor) gets the final block; tier 1 experience
// questions get behavioural; everything else gets technical.
const CODE_ASK_Q =
  /\b(write|implement|code (up|this|it)|coding|program|function|algorithm|big.?o|time complexity|leetcode|two.?sum|palindrome|fibonacci|linked list|binary (search|tree)|hash ?map|array|substring|reverse (a|the) (string|list)|sql (query|to)|query (to|that)|regex (to|for|that)|script (to|that)|class (that|to)|refactor|debug (this|the)|unit test|endpoint)\b/i
// (The final-round mode is keyed to the Director answering level in
// modeBlock below — owner directive, 22 Oct 2026: three levels.)

const MODE_BLOCKS: Record<string, string> = {
  conversational: `CONVERSATIONAL MODE: The interviewer wants a direct person-to-person answer. Match the latest question: short definition, sincere acknowledgement, concise comparison, clear personal value or practical availability. Do not force a technical drill-down, a historical incident, a rejected alternative, a project rotation or a metrics scoreboard. If this is a closing, ask one or two thoughtful questions rather than making a sales pitch.`,
  behavioural: `BEHAVIOURAL MODE: they score evidence about you, not systems. Each answer is one real moment, told as what you did.
- Tell the PROJECT from the background below, at its employer: one project and one employer per answer.
- A failure, conflict or feedback story is built on a prepared answer below or a bottleneck from your background, with roles, never names.
- Most of the answer is your own moves, in order: "I" for your decisions, "we" only for shared execution, the other role named.
- Answer the follow-up before it comes: the call that was yours, one detail a layer down, how you knew it worked, what you changed afterwards.
- Own a miss early, say the cost flatly, blame nobody, and give the other side's reason fairly.
- The result is a change of state: what changed, what is still running, who it helped. Figures from the background only, and no adjective grading it.
- If the JD names Amazon or its Leadership Principles, aim the story at the one principle the question points to and let the result prove it. Never say its name.
- Never a student, lab or side-project story.`,
  technical: `TECHNICAL MODE: they score mechanism, judgement and evidence, never vocabulary.
- Match technical depth to the current ask rather than trying to meet a fixed share of technical jargon.
- For a basic what-is question, define and explain its purpose. Only for an explicit mechanics or troubleshooting question, trace the requested data flow, failure and verification.
- Show a rejected alternative only when the interviewer asks for a decision, design trade-off or option comparison. Do not force one into every definition or tool familiarity question.
- Use the background to understand the technologies in use. Personal achievements and client stories belong only when the question asks about personal work.
- A tool the background does not name: one clause says it was not yours and names the product you ran for that job, then the full answer in the present tense.
- For remediation or incident questions, explain evidence of effectiveness and what remains unresolved. For a direct concept question, stop after the concept is clear.
- Stay inside what was asked: a question about one product is answered from inside it, and the wider stack only if they ask.`,
  // Owner, 23 Oct 2026: answers are read and spoken, so no code is shown. The earlier rule (one fenced, runnable block)
  // is in git history; a live round that needs typed code would need its own view, which is the owner's call.
  coding: `CODING INTERVIEW. When they ask you to write, fix, optimise or design code, say the solution the way you would talk it through with the interviewer, and show no code: (1) one sentence on the approach and its cost in plain words (for example, it runs in linear time and keeps one small lookup table); (2) the steps in the order the code runs, each one sentence: what it takes in, what it checks, what it keeps, what it returns, naming the function, library or data structure as a word; (3) one edge case and how the solution handles it, and one trade-off or alternative you would mention. No code blocks, no inline code, no symbols, operators or formulas: say equals, greater than, plus, divided by, or better, the meaning. Use the language they name; otherwise the one the background shows most. Never invent an API, library function or flag; if unsure it exists, describe the plain construct. Talk about THIS solution: never claim you wrote it before or tie it to a project, test suite, pipeline or tool unless the background shows exactly that.`,
  final: `FINAL ROUND (Architect, Director, Lead, Supervisor). Answer the question word for word: sentence one is the answer to exactly what they asked, in their terms. Then only what that question needs — the decision, the reason, the one fact that proves it. No preamble, no background they did not ask for, no second topic, no recap, no pitch. Every sentence must earn its place; stop when the question is answered.`,
}

function modeBlock(tier: number, question: string, level: string): string {
  if (tier === 0) return INTRODUCTION_POLICY
  if (CODE_ASK_Q.test(question)) return MODE_BLOCKS.coding
  if (["value","closing-question","acknowledgement","comparison","definition","logistics"].includes(interviewIntent(question))) return MODE_BLOCKS.conversational
  // The final-round block belongs to the Director LEVEL (owner, 22 Oct 2026:
  // three levels) — not to whichever anchor happens to be writing, so an
  // Architect + Developer answer keeps its full build depth.
  if (level === "director") return MODE_BLOCKS.final
  if (tier === 1) return MODE_BLOCKS.behavioural
  return MODE_BLOCKS.technical
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

type AnswerJob = {
  question: string
  system: string
  userText: string
  plan: LengthPlan
  interviewer: string
  level: string
  register: string
  shape: string
  tier: number
  fallbackText: string
  orKey: string | undefined
  keys: LlmKeys
  liveModel: string
  ledger: ReturnType<typeof normLedger>
  projectId: string | null
  startedAt: number
  // Grounding guards (perfACT anti-hallucination): the facts a claim may be
  // filled from, the figures the answer may state, and the full source text
  // for the optional post-generation fact-check.
  guardFacts: SpeakFacts
  allowed: Set<string>
  factsText: string
  streamPolicy: KompasStreamPolicy
}

// The lanes, in order: an explicit OpenRouter pick from the live screen first,
// then the primary, then the fallback model. Models on a long rate-limit block
// are skipped — a later request finds them cooled down.
// The live Model menu (public/kompas/app.js LIVE_MODELS) sends liveModel. From 14 Oct 2026, when answering moved here from
// the perfACT engine, every lane was PAID_MODEL and the streams hard-coded it, so "GPT Luna" in the menu silently did
// nothing (found 27 Oct). A chosen model answers first and the default stays behind it as the fallback; anything not on
// this list is the default.
const LIVE_MODEL_IDS: Record<string, string> = { "gpt-5.6-luna": "openai/gpt-5.6-luna" }
function jobLanes(job: AnswerJob): string[] {
  const chosen = LIVE_MODEL_IDS[job.liveModel || ""]
  return chosen ? [chosen, PAID_MODEL] : [PAID_MODEL]
}
function openLanes(job: AnswerJob): { lanes: string[]; blockedNote: string } {
  const lanes = jobLanes(job).filter((m) => (blockedUntil.get(m) || 0) <= Date.now())
  let blockedNote = ""
  if (!lanes.length) {
    const soonest = Math.min(...jobLanes(job).map((m) => blockedUntil.get(m) || 0))
    if (Number.isFinite(soonest) && soonest > Date.now())
      blockedNote = `openrouter 429 try again in ${soonest - Date.now()}ms (all lanes cooling down)`
  }
  return { lanes, blockedNote }
}

function recordLane(model: string, ok: boolean, usage: { input: number; output: number } | undefined, began: number, status?: number) {
  scheduleLlmRecord({
    at: Date.now(), app: "kompas", purpose: "answer", provider: "openrouter", model, ok,
    ...(status ? { status } : {}),
    input: usage?.input || 0, output: usage?.output || 0, cacheRead: 0, cacheWrite: 0, ms: Date.now() - began,
  })
}

// SSE answer: meta → deltas → (wait) → replace → done. The exact event contract
// perfACT's frontend speaks, so the self-hosted app.js needs no changes.
// Structural repair: prompt wording dropped the design alternative and the
// director sentence-one owner across three live samples, so code checks for
// them and one targeted rewrite adds only what is missing. The original
// stands on any failure, and a repair that fixes nothing is discarded —
// never a worse answer, never a second rewrite.
async function repairStructure(job: AnswerJob, guardedText: string, req: NextRequest): Promise<{ text: string; repaired: number }> {
  const opts = { level: job.level, register: job.register, shape: job.shape, tier: job.tier }
  const structureMissing = missingStructure(guardedText, opts)
  const explicitParts = questionParts(job.question)
  const precisionMissing = explicitParts.length >= 2 ? missingQuestionParts(job.question, guardedText) : []
  // A soft/personal question with multiple unrelated specialist phrases should
  // be simplified before it reaches the candidate. This check is diagnostic
  // and conservative: expert questions never trigger this specific repair.
  const offTopic = tangentSignals(job.question, guardedText)
  const namedMissing = missingNamedQuestionTerms(job.question, guardedText)
  const missing = [...namedMissing.map(t => `the interviewer explicitly named ${t}; explain its relevance`), ...structureMissing, ...precisionMissing.map(p => `the interviewer explicitly asked about ${p}`), ...offTopic.map(t => `remove the unasked technical tangent ${t} and keep the direct answer`)]
  if (!missing.length || !job.orKey) return { text: guardedText, repaired: 0 }
  // At most two attempts: the second names exactly what the first rewrite
  // still missed. A failed call is not retried; a rewrite that fixes nothing
  // is discarded, never shipped. The abort signal is the request signal, not
  // the 55s lane signal: a repair at settle time must not inherit only the
  // lane budget left over after generation, or it aborts silently and the
  // original stands no matter what the rewrite would have fixed.
  let stillMissing = missing
  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt === 0 ? "" : `\n\nYour previous rewrite still missed:\n${stillMissing.map((m) => `- ${m}`).join("\n")}\nThe rewritten answer MUST contain each item above.`
    try {
      const { text } = await fetchOpenRouter(job.orKey, PAID_MODEL, offTopic.length ? `${STRUCTURE_REPAIR_SYSTEM}\nWhen the missing element says remove an unasked tangent, actually delete that jargon and its unrelated clause. Keep the one direct answer and every genuinely requested point; do not replace it with a different technical story.` : STRUCTURE_REPAIR_SYSTEM,
        `QUESTION: ${job.question}\n\nANSWER:\n${guardedText}\n\nMISSING:\n${missing.map((m) => `- ${m}`).join("\n")}${extra}\n\nReturn the full rewritten answer and nothing else.`,
        1600, AbortSignal.any([req.signal, AbortSignal.timeout(60000)]))
      const repaired = text.trim()
      if (!repaired) return { text: guardedText, repaired: 0 }
      const rg = applyGuards(repaired, job.guardFacts, job.allowed)
      if (!rg.text.trim()) return { text: guardedText, repaired: 0 }
      stillMissing = [...missingStructure(rg.text, opts), ...(explicitParts.length >= 2 ? missingQuestionParts(job.question, rg.text).map(p => `the interviewer explicitly asked about ${p}`) : []), ...missingNamedQuestionTerms(job.question, rg.text).map(t => `the interviewer explicitly named ${t}; explain its relevance`), ...tangentSignals(job.question, rg.text).map(t => `remove the unasked technical tangent ${t} and keep the direct answer`)]
      if (stillMissing.length < missing.length && stillMissing.every(m => missing.includes(m))) return { text: rg.text, repaired: 1 }
    } catch { return { text: guardedText, repaired: 0 } }
  }
  return { text: guardedText, repaired: 0 }
}

async function streamAnswer(req: NextRequest, job: AnswerJob): Promise<Response> {
  const encoder = new TextEncoder()
  const startedAt = job.startedAt
  const metaBase = {
    engine: "marketfit",
    interviewer: job.interviewer,
    level: job.level,
    register: job.register,
    tier: job.tier,
    length: { kind: job.plan.kind, secs: job.plan.secs },
    derived: job.question,
    words: job.plan.words,
  }
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const { signal, cleanup } = laneSignal(req, 55000)
      const emit = (o: Record<string, unknown>) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(o)}\n\n`)) } catch { /* client went away */ }
      }
      const timing = { preparation_ms: Date.now() - startedAt, first_ms: 0, visible_first_ms: 0, lane: "", total_ms: 0 }
      let raw = ""
      let lastErr = ""
      let servedModel = ""
      const servedProvider = "openrouter"
      const onDelta = (d: string) => {
        if (!raw && d) timing.first_ms = Date.now() - startedAt
        raw += d
        if (releaseProvisionalDelta(job.streamPolicy)) {
          if (!timing.visible_first_ms && d) timing.visible_first_ms = Date.now() - startedAt
          emit({ type: "delta", text: d })
        }
      }
      try {
        emit({ type: "meta", ...metaBase, streamPolicy: job.streamPolicy })
        if (job.orKey) {
          const runLane = async (model: string, tag: string): Promise<"ok" | "cut" | "fail"> => {
            const began = Date.now()
            timing.lane += (timing.lane ? ">" : "") + `openrouter:${shortModel(model)}${tag}`
            try {
              const usage = await streamOpenRouter(job.orKey as string, model, job.system, job.userText, job.plan.maxTokens, onDelta, signal)
              if (cutShort(usage.finish, raw, job.plan.words)) {
                // Cut off at the ceiling a few words in: clear the card and ask again rather than serve a fragment.
                recordLane(model, false, usage, began, 502)
                lastErr = "openrouter 502 answer cut short at the token ceiling"
                raw = ""
                emit({ type: "replace", text: "" })
                return "cut"
              }
              servedModel = model
              lastErr = ""
              recordLane(model, true, usage, began)
              return "ok"
            } catch (e) {
              lastErr = String((e as Error)?.message || e).slice(0, 200)
              recordLane(model, false, undefined, began, statusOf(lastErr))
              return "fail"
            }
          }
          let askedAgain = false
          const attempt = async (tag: string) => {
            const { lanes, blockedNote } = openLanes(job)
            if (blockedNote && !lastErr) lastErr = blockedNote
            for (const m of lanes) {
              if (raw || signal.aborted) break
              if (await runLane(m, tag) === "cut" && !askedAgain && !signal.aborted) { askedAgain = true; await runLane(m, tag + ":again") }
            }
          }
          await attempt("")
          // Every lane rate-limited: wait exactly what the provider said (≤15s)
          // and retry the lanes once — the client shows a countdown meanwhile.
          if (!raw.trim() && isRateLimit(lastErr)) {
            const wait = retryMs(lastErr)
            if (wait > 0 && wait <= 15000) {
              emit({ type: "wait", ms: Math.round(wait + 300) })
              await sleep(wait + 300)
              await attempt(":retry")
            }
          }
        } else { lastErr = "openrouter 503 missing paid key" }

        // Still rate-limited with nothing streamed: never a 5xx on a live turn —
        // hand the client an exact wait; it regenerates by itself.
        if (!raw.trim() && isRateLimit(lastErr)) {
          const wait = retryMs(lastErr)
          emit({
            type: "done", busy: true,
            retryAfterMs: Math.min(60000, Math.ceil(wait || 0) + 500),
            daily: /per day/i.test(lastErr) || (wait || 0) > 60000,
            ledger: job.ledger,
            ...metaBase, provider: servedProvider, model: servedModel,
            timing: { ...timing, total_ms: Date.now() - startedAt },
          })
          return
        }
        // Degrade, never fail: stream the best prepared material as the answer.
        const degraded = false
        if (!raw.trim() || lastErr) {
          const failure = answerFailure(lastErr)
          emit({ type: "replace", text: "" })
          emit({ type: "done", unavailable: true, degraded: true, ...failure, ...metaBase, provider: "openrouter", model: PAID_MODEL })
          return
        }
        // Grounding guards (perfACT anti-hallucination) run on the complete
        // text: unbracket → place/prestige/title/version fixes → figures
        // allowlist. Voice repair runs after — the client's `replace` event
        // swaps the streamed draft for the finished answer.
        const g = applyGuards(correctVerifiedPresentationErrors(raw.trim()), job.guardFacts, job.allowed)
        let guardedText = g.text
        let repaired = 0
        {
          const r = await repairStructure(job, guardedText, req)
          guardedText = r.text
          repaired = r.repaired
        }
        let finalText = readAloud(job.tier === 0 ? (voiceRepair(guardedText) || guardedText).replace(/\[(?:beat|breath)\]|\(pause\)/gi, ' ') : blendSpoken(voiceRepair(guardedText) || guardedText) || guardedText) || guardedText
        // Optional post-generation fact-check: the model only POINTS at
        // unsupported claims; code does the replacement, so the fix is
        // guaranteed. Env-gated (costs one light call) like perfACT's
        // PERFACT_VERIFY.
        let verified = 0
        if (process.env.KOMPAS_VERIFY === "1" && !degraded && job.factsText && job.orKey) {
          try {
            const v = await verifyAnswer(
              (s, u) => verifyGenerate(job.orKey as string, s, u, signal),
              job.factsText, finalText,
            )
            if (v?.text) { verified = v.fixed; finalText = v.text }
          } catch { /* the guarded answer stands */ }
        }
        finalText = correctVerifiedPresentationErrors(finalText)
        // Personal history is held back until guards have run. Even if unchanged,
        // it must be emitted now because no provisional deltas were sent.
        if (mustEmitFinalReplacement(job.streamPolicy, finalText, raw)) {
          if (!timing.visible_first_ms && finalText) timing.visible_first_ms = Date.now() - startedAt
          emit({ type: "replace", text: finalText })
        }
        emit({
          type: "done", degraded, guarded: g.guarded, verified, repaired,
          precision: { coverage: questionCoverage(job.question, finalText), flags: [...spokenQualityFlags(job.question, finalText), ...tangentSignals(job.question, finalText).map(t => `off-topic-jargon:${t}`), ...missingNamedQuestionTerms(job.question, finalText).map(t => `missing-named-term:${t}`)] },
          ledger: job.ledger,
          ...metaBase, provider: servedProvider, model: servedModel,
          timing: { ...timing, total_ms: Date.now() - startedAt },
        })
      } finally {
        cleanup()
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      "Cache-Control": "no-store",
    },
  })
}

// Non-streaming answer: same lanes, one JSON body. Kept for non-browser callers.
async function jsonAnswer(req: NextRequest, job: AnswerJob): Promise<NextResponse> {
  const { signal, cleanup } = laneSignal(req, 55000)
  let raw = ""
  let lastErr = ""
  let servedModel = ""
  const servedProvider = "openrouter"
  try {
    if (job.orKey) {
      const runLane = async (model: string) => {
        const began = Date.now()
        try {
          const r = await fetchOpenRouter(job.orKey as string, model, job.system, job.userText, job.plan.maxTokens, signal)
          raw = r.text
          servedModel = model
          lastErr = ""
          recordLane(model, true, r.usage, began)
        } catch (e) {
          lastErr = String((e as Error)?.message || e).slice(0, 200)
          recordLane(model, false, undefined, began, statusOf(lastErr))
        }
      }
      const attempt = async () => {
        const { lanes, blockedNote } = openLanes(job)
        if (blockedNote && !lastErr) lastErr = blockedNote
        for (const m of lanes) { if (raw || signal.aborted) break; await runLane(m) }
      }
      await attempt()
      if (!raw.trim() && isRateLimit(lastErr)) {
        const wait = retryMs(lastErr)
        if (wait > 0 && wait <= 15000) { await sleep(wait + 300); await attempt() }
      }
    } else { lastErr = "openrouter 503 missing paid key" }
  } finally { cleanup() }
  const degraded = !raw.trim()
  if (degraded) {
    const failure = answerFailure(lastErr)
    return NextResponse.json({ ...failure, provider: "openrouter", model: PAID_MODEL }, { status: failure.status, headers: NO_STORE })
  }
  // Grounding guards before voice repair: unbracket → place/prestige/title/
  // version fixes → figures allowlist. Then the optional fact-check.
  const g = applyGuards(correctVerifiedPresentationErrors(raw.trim()), job.guardFacts, job.allowed)
  let guardedText = g.text
  let repaired = 0
  {
    const r = await repairStructure(job, guardedText, req)
    guardedText = r.text
    repaired = r.repaired
  }
  let out = readAloud(job.tier === 0 ? (voiceRepair(guardedText) || guardedText).replace(/\[(?:beat|breath)\]|\(pause\)/gi, ' ') : blendSpoken(voiceRepair(guardedText) || guardedText) || guardedText) || guardedText
  let verified = 0
  if (process.env.KOMPAS_VERIFY === "1" && !degraded && job.factsText && job.orKey) {
    try {
      const v = await verifyAnswer(
        (s, u) => verifyGenerate(job.orKey as string, s, u, signal),
        job.factsText, out,
      )
      if (v?.text) { verified = v.fixed; out = v.text }
    } catch { /* the guarded answer stands */ }
  }
  out = correctVerifiedPresentationErrors(out)
  if (!out.trim()) return NextResponse.json({ error: "Nothing to answer." }, { status: 400, headers: NO_STORE })
  void lastErr
  return NextResponse.json({
    text: out,
    polished: true,
    precision: { coverage: questionCoverage(job.question, out), flags: [...spokenQualityFlags(job.question, out), ...tangentSignals(job.question, out).map(t => `off-topic-jargon:${t}`), ...missingNamedQuestionTerms(job.question, out).map(t => `missing-named-term:${t}`)] },
    degraded,
    guarded: g.guarded,
    verified,
    repaired,
    ledger: job.ledger,
    meta: {
      engine: "marketfit", provider: servedProvider, model: servedModel,
      interviewer: job.interviewer, tier: job.tier, kind: job.plan.kind, words: job.plan.words,
      routed: job.projectId,
      timing: { total_ms: Date.now() - job.startedAt },
    },
  }, { headers: NO_STORE })
}

/** Internal entry point: callers must verify the channel identity before invoking. */
export async function answerForVerifiedUser(request: NextRequest, user: { id: string }) {
  const startedAt = Date.now()
  if (!user?.id) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-answer:${user.id}`, { max: 60, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })

  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400, headers: NO_STORE })
  }

  // Deterministic question detection needs neither storage nor a provider call.
  // The code gates (src/lib/kompasAnswer.ts deriveByCode) are the ones the baseline contract replays.
  if (body.deriveOnly) {
    const clean = deriveByCode(str(body.question, 5000), body.history, body.reask === true)
    if (clean === null) return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    if (clean) return NextResponse.json({ derived: clean, derivedBy: "code" }, { headers: NO_STORE })
  }

  const vaultKeys = await keysFor("kompas:answer", () => resolveKeys({}))
  const paidKey = vaultKeys.openrouter || resolveKeys({}).openrouter
  if (!paidKey) return NextResponse.json({ error: "Paid OpenRouter is not configured.", code: "OPENROUTER_NOT_CONFIGURED" }, { status: 503, headers: NO_STORE })
  if (body.preflight === true) {
    try {
      await fetchOpenRouter(paidKey, PAID_MODEL, "Reply with READY only.", "Check answer service readiness.", 256, AbortSignal.any([request.signal, AbortSignal.timeout(20000)]))
      return NextResponse.json({ ready: true, provider: "openrouter", model: PAID_MODEL, checkedAt: Date.now() }, { headers: NO_STORE })
    } catch (e) {
      const failure = answerFailure(String((e as Error)?.message || e))
      return NextResponse.json({ ready: false, ...failure }, { status: failure.status, headers: NO_STORE })
    }
  }
  const rawKeys: LlmKeys = { openrouter: paidKey }

  // deriveOnly: the frontend asking "was that a question?" — cheapest first.
  // Gate 1 (code): speaker-aware — no Them: line and no ask pattern = no question.
  // Gate 2 (code): the transcript reduces to one clean question → extract verbatim.
  // Gate 3 (model): consolidated derivation with speaker labels.
  if (body.deriveOnly) {
    // The page sends the new speech as `question` and what was already answered as `transcript`.
    // Deriving from the earlier text is what answered "No question yet" while the question was the new speech.
    const heard = str(body.question, 5000)
    const earlier = str(body.transcript, 900)
    const clean = deriveByCode(heard, body.history, body.reask === true)
    if (clean === null) return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    if (clean) return NextResponse.json({ derived: clean, derivedBy: "code" }, { headers: NO_STORE })
    try {
      const { text } = await fetchOpenRouter(paidKey, PAID_MODEL, DERIVE_SYSTEM,
        `${earlier ? `EARLIER (already answered — context only):\n${earlier}\n\n` : ""}HEARD:\n${heard}`,
        500, AbortSignal.any([request.signal, AbortSignal.timeout(15000)]))
      const derived = text.trim()
      if (!derived || /^NO_QUESTION/i.test(derived))
        return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
      return NextResponse.json({ derived }, { headers: NO_STORE })
    } catch {
      return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    }
  }

  const heardAll = str(body.question, 4000)
  const asked = str(body.derived, 2000)
  // The card already shows the question when the client pins it. A ramble still
  // yields to the ask inside that line. "Okay" stays unanswered. Anything else
  // typed or heard is the question — dropping it left the card on the previous answer.
  const again = body.again === true
  let question = latestInterviewerAsk(questionForAnswer(heardAll, asked, body.pinned === true, again, body.history))
  if (!question) {
    const quiet = `data: ${JSON.stringify({ type: "meta", noQuestion: true })}\n\ndata: ${JSON.stringify({ type: "done", noQuestion: true })}\n\n`
    if (body.stream) {
      return new Response(quiet, { headers: { "content-type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" } })
    }
    return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
  }

  const config = (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>
  // The active sources take precedence over an older profile or generated Q&A.
  // Never make a grounded live turn wait for three remote dossier reads.
  const resumeSrc = str(config.resume, 60000)
  const jdSrc = str(config.jd, 8000)
  const docsSrc = str(config.documents, 8000)
  let grounding = ""
  if (!resumeSrc && !docsSrc) {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      grounding = await Promise.race([
        dossierContext(hashUserId(user.id), "general"),
        new Promise<string>((resolve) => { timer = setTimeout(() => resolve(""), 300) }),
      ])
    } catch { /* optional historical context must not block a live turn */ }
    finally { if (timer) clearTimeout(timer) }
  }
  const interviewer = str(config.interviewer, 40) || "engineer"
  // The answering LEVEL (owner, 22 Oct 2026: exactly three levels). The client
  // sends the level the user has selected RIGHT NOW on every request, so a
  // level switch changes the very next answer — nothing is pinned at session
  // start. `interviewer` above stays the anchor voice (engineer/director) the
  // prose is written under; the level controls register and depth.
  const level = answerLevel(config.level, interviewer)
  const prep = (body.prep && typeof body.prep === "object" ? body.prep : {}) as Record<string, unknown>
  const transcript = str(body.transcript, 4000)
  const historyArr = Array.isArray(body.history) ? body.history : []
  const history = formatInterviewHistory(historyArr)
  const rediscovered = rediscoverRelevance(question, history)
  const retrievedList = Array.isArray(body.retrieved)
    ? body.retrieved.map((r) => str(r, 500)).filter(Boolean)
    : []
  const retrieved = retrievedList.slice(0, 4).join("\n")

  // perfACT's answering intelligence: classify → tier rule → length plan. (A topic-less follow-up was already glued to
  // the previous question in code by questionForAnswer.)
  // The normalized ask, not background keyword baggage, controls tier,
  // source selection, word budget, repair checks and named-term verification.
  // Preserve the full current-turn utterance separately for its real constraints.
  const originalAsk = question
  const { tier, why } = classify(rediscovered.currentAsk || question)
  // Minimal intro triggers ("intro") get a canonical question so the model
  // generates a spoken self-introduction instead of echoing the trigger.
  question = canonicalQuestion(rediscovered.currentAsk || question, tier)
  // The question's own register decides how deep ANY level may go: a concept
  // question (define / compare / what-is) is answered abstractly, a practice
  // question (his work, a scenario, a deep example) takes the level's depth.
  let register = questionRegister(question, tier)
  const focus = focusPlan(question, tier, level)
  const plan = lengthPlan(tier, question, level, {
    difficulty: str(config.difficulty, 20) || undefined,
    length: str(config.length, 20) || undefined,
    register,
  })
  const desktopPolicy = config.responseCalibration === "three-level-v1" ? desktopResponsePolicy(level, question) : null
  if (desktopPolicy) register = desktopPolicy.kind === "experience" || desktopPolicy.kind === "implementation" ? "practice" : "concept"
  if (desktopPolicy && tier !== 0 && plan.kind !== "code") {
    plan.words = desktopPolicy.words
    plan.secs = [Math.round(plan.words * 0.8 / 2.5), Math.round(plan.words * 1.25 / 2.5)]
    plan.maxTokens = Math.min(4000, Math.max(600, Math.round(plan.words * 2.6) + 300))
  }
  // The real question sets the spoken word ceiling, overriding arbitrary
  // session depth and fixed technical quotas. Do not pad an already complete answer.
  if (plan.kind !== "code") {
    plan.words = applyFocusBudget(plan.words, focus)
    plan.secs = [Math.round(plan.words * 0.8 / 2.5), Math.round(plan.words * 1.25 / 2.5)]
    plan.maxTokens = Math.min(plan.maxTokens, Math.max(600, Math.round(plan.words * 2.6) + 350))
  }
  // Depth calibration inside the practice register: match the answer's focus
  // to the question's depth. A surface question gets a direct answer; a deep
  // scoped question gets a focused deep dive. (Concept questions are governed
  // by the level block below, which caps them abstract at every level.)
  const qDepth = questionDepth(question)
  const depthGuidance = register === "concept" ? ""
    : qDepth < 0.75
    ? "ANSWER CALIBRATION: This is a surface-level question. Answer directly and briefly. Do not expand into a deep technical narrative — match the question's scope."
    : qDepth > 1.25
    ? "ANSWER CALIBRATION: This is a deep, scoped question. Go deep on the specific angle asked — concrete details, trade-offs, and real constraints. Stay focused on what was asked, don't broaden."
    : ""
  const personalEvidence = isPersonalEvidenceQuestion(tier, question)
  const storyMode = rediscovered.intent === "experience-story" || (rediscovered.intent === "follow-up" && tier === 3)
  const includeStoryContext = personalEvidence && storyMode && tier !== 0
  const includeHistoryContext = rediscovered.contextRelation === "follow-up" || rediscovered.intent === "experience-story"
  const rule = tierRule(tier, level)
  // 27 question archetypes (perfACT _shapes.js): first-win structural instruction.
  const shape = tier === 0 || !["scenario","technical-process","experience-story","follow-up"].includes(focus.intent) ? "" : pickShape(question, tier, grounding + " " + str(prep.projects, 2000))
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
  if (personalEvidence && storyMode && tier !== 0 && ledgerProjects.length) {
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

  // Re-asks retain the question-calibrated plan; repeatQuestionGuidance preserves scope.

  // perfACT's resume intelligence: the resume is where the specifics live
  // (employer, tools, platforms). TF-IDF digest fitted to THIS question so
  // the model sees the right experience — a naive head-cut of a long resume
  // holds only the summary and skills, never the experience section.
  // Complements the dossier (the growing store); this is the fitted excerpt.
  const resumeText = resumeSrc
  let resumeFacts = ""
  if (resumeText && resumeText.length > 200) {
    const rr = resumeRoles(resumeText)
    const aliasLines = employerAliases(
      rr.employers,
      `${question}\n${transcript}`,
    ).map(
      (a) => `SAME EMPLOYER: "${a.said}" (as said in this interview) is the resume's "${a.resume}" — you work there. Say "${a.said}".`,
    )
    const askForDigest = question // prior speech does not determine relevance ranking
    const digest = resumeDigest(resumeText, askForDigest, tier === 0 ? 14000 : plan.kind === "short" ? 1600 : 4600, tier === 0 ? "career" : "focused")
    resumeFacts = [
      rr.current ? `CURRENT ROLE (from the resume — use this exact title): ${rr.current}` : "",
      ...aliasLines,
      `RESUME (${tier === 0 ? "career-wide evidence across supported roles" : "fitted to this question"}):\n${digest}`,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const context = [
    `The listener is at ${ANSWER_LEVEL_NAME[level]}. The level block below is the controlling spec for this answer's depth and register.`,
    tier === 0 ? `INTRODUCTION AUDIENCE: ${level}. Audience adjusts language and emphasis, not the career-wide scope. No step-by-step project reconstruction.` : levelGuidance(level, register),
    `LATEST ACTUAL QUESTION INTENT: ${rediscovered.intent}. Answer mode: ${rediscovered.answerMode}. The old perfACT tier is merely a shape hint: ${why} (tier ${tier}).`,
    storyMode || ["scenario","technical-process"].includes(rediscovered.intent) ? `DEEP QUESTION RULE: ${rule}` : "",
    `INTERVIEW MODE: ${modeBlock(tier, question, level)}`,
    shape ? `ANSWER SHAPE (follow this structure): ${shape}` : "",
    level === "director" ? DIRECTOR_OPENING : "",
    `LENGTH CEILING: usually no more than ${plan.words} spoken words (${plan.secs[0]}-${plan.secs[1]} seconds). Do not pad the response; finish when all asked parts are answered.`,
    depthGuidance,
    storyMode && tier !== 0 && routedProject
      ? `Only if the original sources corroborate it, anchor this answer in this generated project summary: ${routedProject.title}${routedProject.employer ? ` (${routedProject.employer})` : ""}. Do not switch projects mid-answer.`
      : "",
    storyMode && bott ? `Unverified generated bottleneck; use only if corroborated by original sources: ${bott}.` : "",
    storyMode && angle && tier !== 0 && plan.kind !== "code" ? `Fresh angle for this telling: ${angle}.` : "",
    includeStoryContext && tier !== 3 && toldNames.length
      ? `Stories already told this session — do not retell them: ${toldNames.join("; ")}.`
      : "",
    includeStoryContext && prep.identity ? `UNVERIFIED generated identity: ${str(prep.identity, 800)}` : "",
    includeStoryContext && prep.persona ? `Persona: ${str(prep.persona, 800)}` : "",
    includeStoryContext && prep.projects ? `UNVERIFIED generated project summaries: ${str(prep.projects, 2000)}` : "",
    includeStoryContext && grounding ? `Historical context (personal claims require original source corroboration):\n${grounding.slice(0, 4500)}` : "",
    resumeFacts ? `${resumeFacts}` : "",
    tier !== 0 && jdSrc && !["closing-question","acknowledgement","definition","logistics"].includes(rediscovered.intent) ? `JOB DESCRIPTION (role priorities, not candidate history):\n${jdSrc}` : "",
    docsSrc ? `ORIGINAL SOURCE DOCUMENTS:\n${docsSrc}` : "",
    str(config.instructions, 2000) ? `SESSION PREFERENCES (delivery only; do not override source evidence): ${str(config.instructions, 2000)}` : "",
    `SOURCE PRIORITY: the current resume and original documents establish personal history. The JD sets relevance. Generated prep, prior answers and transcript are unverified. A resume bullet does not establish a specific incident, root cause, HSM vendor or measured outcome. If no incident is documented, explain the proposed approach conditionally.`,
    tier !== 0 && includeHistoryContext && transcript ? `Brief conversation context for this follow-up only:\n${transcript.slice(-800)}` : "",
    tier !== 0 && history && includeHistoryContext ? `Earlier conversation (only to resolve explicit references, never to supply an unrelated project or topic):\n${history}` : "",
    includeStoryContext && retrieved ? `Retrieved notes:\n${retrieved}` : "",
  ].filter(Boolean).join("\n\n")

  // The vault decides which providers this feature may use (Admin → "Which AI
  // each feature uses"). OpenRouter lanes run only when the vault leaves the
  // key in; otherwise one vault-honoring call is made and delivered as SSE.
  const keys = rawKeys
  const fallbackText = tier === 0 ? "I need the current resume evidence to give a reliable career overview. Please retry the introduction." : retrievedList[0]
    || (prep.identity ? str(prep.identity, 600) : "")
    || "The answer engine is at its limit right now — press AI Answer again in a moment."
  // Grounding guards (perfACT anti-hallucination): the facts a claim may be
  // filled from (employer/title/known), the figures the answer may state, and
  // the source text for the optional post-generation fact-check.
  const guardFacts = speakFacts({
    resume: resumeSrc,
    jd: "",
    documents: docsSrc,
    heard: "",
    identity: "",
    projects: "",
  })
  const allowed = allowedNumbers(resumeSrc, docsSrc) // the interviewer asking a number is NOT proof that the candidate achieved it
  const figuresList = [...allowed].slice(0, 30)
  const figuresLine = `FIGURES: the ONLY result numbers you may state are these, from the candidate's own material: ${figuresList.length ? figuresList.join(", ") : "(none)"}. Never invent a count, percentage, duration or before/after figure — describe the change in words ("cut the queue to something the team could clear by lunch"). Technical constants (ports, versions, thresholds in a rule) are fine.`
  const factsText = candidateEvidenceForVerification(resumeSrc, docsSrc)
  // Role requirements and generated dossier context guide relevance, not personal factual proof.
  const desktopCloser = desktopPolicy
    ? `${desktopPolicy.guidance}\n\nObey the question shape. A definition or a comparison stays on the idea. A deep example carries the bottleneck and the impact at this level's angle. Do not reuse one outline for both.`
    : ""
  const spokenCloser = `Speak it. Sentence one is the answer in words this listener already understands. Then one path. On every sentence, ask whether you are 100% on this question, at this layer. A sentence that is not, is not said.
A general scenario — a time, a would-you, a launch, or a people question: the decision or the moment, in plain words, and one picture. Do not open a mechanism they did not ask for. If the background has no such incident, say what you would do.
A technical question — a what-is, a how, an investigate, a fix, or a test: specialist, spoken the way a person talks in the meeting. Simple words, or one abstract sentence that carries the meaning. Do not recite a query, a parameter, a claim name, or a stack. Inside a program, write the real numbers. A status code, a port, and a literal in code stay written as themselves. Make the most important distinction clear in normal spoken words, without double-underscores or another formatting marker.
When the question has multiple parts, cover all of them. Do not open unasked topics.

${INTERVIEW}`
  // Every part the question asks for, in its order, and the conditions it sets (requestedParts): a compound or listed
  // ask is answered part by part, not as its first or last clause.
  const asks = tier !== 0 ? requestedParts(question) : { parts: [] as string[], constraints: [] as string[] }
  const partsBlock = asks.parts.length >= 2 || asks.constraints.length
    ? `THE QUESTION ASKS FOR, in this order (cover every one inside your natural spoken answer, the same voice and depth as always; this is not an outline to read out):\n${asks.parts.map((p, i) => `${i + 1}. ${p}`).join("\n")}${asks.constraints.length ? `\nAND IT SETS THESE CONDITIONS: ${asks.constraints.join("; ")}` : ""}`
    : ""
  const job: AnswerJob = {
    question,
    system: `${SYSTEM}\n\n${QUESTION_FIRST_POLICY}\n\n${relevanceRecoveryPrompt(originalAsk, history)}\n\n${focusPrompt(question, tier, level)}\n\n${precisionPrompt(question)}\n\n${EVIDENCE_POLICY}\n\nAUDIENCE DELIVERY:\n${tier === 0 ? INTRODUCTION_POLICY : desktopPolicy?.guidance || audienceGuidance(level, question)}\n\n${desktopPolicy && desktopPolicy.kind !== "experience" ? TECHNICAL_ANSWER_BOUNDARY : personalEvidence ? PERSONAL_EXPERIENCE_POLICY : TECHNICAL_ANSWER_BOUNDARY}\n\n${desktopPolicy ? desktopCraft(desktopPolicy.kind) : RESPONSE_CRAFT_POLICY}\n\n${blendPrompt()}\n\n${INTENT_BOUNDARY}\n\n${tier === 0 ? INTRO_CAREER_SPINE : ""}\n\n${tier !== 0 ? desktopPolicy?.guidance || "" : ""}`,
    userText: `ANSWER ONLY THIS:\n${question}\n\n${partsBlock ? `${partsBlock}\n\n` : ""}${context}\n\n${figuresLine}\n\nANSWER ONLY THIS, and nothing beside it: "${question}"\n\n${again ? repeatQuestionGuidance(tier) + "\n\n" : ""}${tier === 0 ? `${INTRODUCTION_POLICY}\n${INTRO_CAREER_SPINE}` : desktopCloser || spokenCloser}`,
    plan,
    interviewer,
    level,
    register,
    shape: shape || "",
    tier,
    fallbackText,
    orKey: keys.openrouter || undefined,
    keys,
    liveModel: str(body.liveModel, 120),
    ledger,
    projectId,
    startedAt,
    guardFacts,
    allowed,
    factsText,
    streamPolicy: answerStreamPolicy(tier, question),
  }
  if (body.stream) return streamAnswer(request, job)
  return jsonAnswer(request, job)
}

function answerFailure(message: string) {
  const status = statusOf(message) || 502
  const code = status === 401 ? "OPENROUTER_AUTH" : status === 402 ? "OPENROUTER_CREDITS" : status === 403 ? "OPENROUTER_FORBIDDEN" : status === 429 ? "OPENROUTER_RATE_LIMIT" : "OPENROUTER_UNAVAILABLE"
  const error = status === 401 ? "The paid OpenRouter credential was rejected."
    : status === 402 ? "The OpenRouter account or key has insufficient credits."
    : status === 403 ? "OpenRouter blocked the request. Check key permissions and account policy."
    : status === 429 ? "The paid provider is temporarily rate limited. Your question is preserved."
    : "The paid provider could not complete this answer. Your question is preserved."
  return { status, code, error }
}
