import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { keysFor, resolveKeys, type LlmKeys } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { dossierContext } from "@/lib/dossier"
import { resumeRoles, resumeDigest, employerAliases } from "@/lib/kompasResume"
import { hashUserId } from "@/lib/sttLedger"
import { scheduleLlmRecord } from "@/lib/llmLedger"
import {
  classify, canonicalQuestion, lengthPlan, plainlyNoQuestion, cleanQuestion, resolveFollowUp,
  tierRule, pickShape, DERIVE_SYSTEM, type LengthPlan,
  normLedger, toLedgerProjects, pickProject, pickBottleneck, pickAngle,
  commit, matchBank,
} from "@/lib/kompasAnswer"
import { voiceRepair } from "@/lib/kompasVoiceRepair"
import { audienceGuidance, EVIDENCE_POLICY } from "@/lib/kompasAudience"
import {
  allowedNumbers, applyGuards, speakFacts, verifyAnswer,
  type SpeakFacts,
} from "@/lib/kompasGuards"

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
): Promise<{ input: number; output: number }> {
  if ((blockedUntil.get(model) || 0) > Date.now())
    throw new Error(`openrouter 429 try again in ${blockedUntil.get(model)! - Date.now()}ms (blocked)`)
  const res = await fetch(OR_URL, {
    method: "POST", signal,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-title": "MarketFit" },
    body: JSON.stringify({
      model: PAID_MODEL, provider: { allow_fallbacks: true }, max_tokens: orCap(maxTokens), stream: true,
      stream_options: { include_usage: true },
      ...reasoningFor(model),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  })
  if (!res.ok || !res.body) throw orError(res, await res.text().catch(() => ""), model)
  let input = 0, output = 0, failure = 0, finished = false, received = false
  await pumpSSE(res.body, (j) => {
    if (j.error) failure = Number(j.error.code) || 502
    if (j.choices?.[0]?.finish_reason) finished = true
    const d = j.choices?.[0]?.delta?.content
    if (typeof d === "string" && d) { received = true; onDelta(d) }
    if (j.usage) { input = j.usage.prompt_tokens || 0; output = j.usage.completion_tokens || 0 }
  })
  if (failure || !received || !finished) throw new Error(`openrouter ${failure || 502} incomplete stream`)
  return { input, output }
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
      model: PAID_MODEL, provider: { allow_fallbacks: true }, max_tokens: orCap(maxTokens),
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
      model: PAID_MODEL, provider: { allow_fallbacks: true }, max_tokens: 1600, temperature: 0,
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
- ANSWER FIRST: the first sentence carries the specific noun — the tool, setting, mechanism, decision or direct answer. Never open by restating the question, with framing, or with praise for the question.
- THINK OUT LOUD. Reason in front of the listener: "It depends on the system — I'm going to assume it's on a Windows server, just to make the example easy."
- CONCRETE OVER ABSTRACT. Explain a specific mechanism and example. Personal projects and observed logs require original supporting evidence; otherwise use a clearly hypothetical example.
- UNFOLD STEP BY STEP, one clear move at a time, with natural pause points.
- 60% human narration, 40% crisp technical. Each technical point said once, said well, inside the story.
- TECHNICAL PRECISION: explain the condition being checked, the action taken, and how success is tested. Name a version only if supported by original source material and relevant to the question. Plain language can be exact; product names alone are not depth.
- CONCRETE NUMBERS FROM FACTS: 'cut MTTD from 4 hours to 12 minutes' not 'much faster', '300 endpoints' not 'a large fleet'. When FACTS is silent on a number, describe scale honestly ('our EDR fleet', 'the ticketing queue') — never invent a figure.
- TALK WITH, NOT AT: natural connected sentences. Do not manufacture filler such as "right?", "you know", or "basically".
- STRUCTURAL PAUSES — write these markers into the text: [beat] (once or twice per answer, BEFORE the key insight the listener must remember), [breath] (between ideas/steps so the listener catches up). Never stack them, never open with one.
- PLAIN VERBS: use, fix, check — not utilize, remediate, validate. Never "stakeholders" (name the role), never "leveraged", never "great question".

CLARITY (the standard for every answer — nothing abstract, unfinished or unclear, ever):
- MIRROR, LIKE CLEAR RIVER WATER: reflect this interviewer's own world back to them — their vocabulary, their priorities, the question behind their question — clean, still and easy to see through. One clear line of thought per paragraph, in a natural order. No tangents, no needless hedging, no stacked qualifiers. State a real uncertainty plainly; confidence never turns an assumption into an observation.
- THE QUESTION'S OWN SUBJECT FIRST: if it names a thing (an alert, a playbook, a control, an outage), the first two sentences deal with that thing. Never swap in a nearby topic you know better.
- EVERY PART ANSWERED: when the question asks two things, answer each one by name. "Who do you tell" is answered with a role (the incident commander, my director), not "the stakeholders".
- A SCENARIO IS A DESIGN: when the question sets a condition ("suppose", "tonight", "if"), answer with what you would do, in order — "I would…", "my first check is…". Past work appears only as one sentence of proof from the background.
- A REQUIREMENT IS A CONSTRAINT, not a trade-off: if the question says a path must stay rare or controlled, keep that requirement in every sentence.
- CONCRETE, NEVER INVENTED: name the tool, setting, log, step or result only when the background supplies it; otherwise describe the check conditionally. Never "various tools", "best practices", "etc." or "and so on".
- NARRATED: connect situation, action, reason and consequence in the order the listener needs. Vary natural connecting words instead of a First/Then/Finally script.
- FINISHED: every point you open, you close. End on a complete, deliberate final sentence — never trail off, never stop mid-thought.
- CANDIDATE VOICE: "I"/"my"/"we" for supported experience, "I would" for a proposed approach. Never describe the answer, the candidate or the interviewer in the third person; never add notes about the answer.

SUBSTANCE:
- Ground personal claims in original resume and source documents. Generated identities, project summaries and prior answers are context, not independent evidence of personal experience.
- EVIDENCE BEFORE STORYTELLING: the background establishes only the experience it states — never upgrade a resume bullet into an incident, a metric, an error message or a date it does not contain. Never invent employers, tools, or metrics.
- The depth level is set by who is asking (given below): tech-HR stays accessible, engineer is practitioner-deep, architect keeps system-design teeth, director stays strategic. Whatever the level, sound like a person reasoning, not a manual.
- HIT THE LENGTH TARGET below — a quick factual ask gets a short answer, a deep dive gets room. Length is the most audible quality signal.

Return only the answer, no preamble, no commentary.`

// ---- perfACT MODE_BLOCKS: interview mode detected per question, not per wizard ----
// coding beats everything (the question asks for code); a final-round interviewer
// (architect/director/lead/supervisor) gets the final block; tier 1 experience
// questions get behavioural; everything else gets technical.
const CODE_ASK_Q =
  /\b(write|implement|code (up|this|it)|coding|function|algorithm|big.?o|time complexity|leetcode|two.?sum|palindrome|fibonacci|linked list|binary (search|tree)|hash ?map|array|substring|reverse (a|the) (string|list)|sql (query|to)|query (to|that)|regex (to|for|that)|script (to|that)|class (that|to)|refactor|debug (this|the)|unit test|endpoint)\b/i
const FINAL_INTERVIEWERS = new Set(["architect", "director", "lead", "supervisor"])

const MODE_BLOCKS: Record<string, string> = {
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
- Hold the 60/40 balance: 60% human narration of the reasoning, 40% crisp technical mechanism.
- Take each part down the ladder: what it is, how it works in the order the data or the attacker moves, why it is built that way and what that costs, and where it breaks.
- Show judgement: the option you rejected and why, the fact that decided it, and the condition that would flip your call. Commit; never end on "it depends".
- Anchor once in work the background below represents: the platform, log source, rule logic, real release or integration.
- A tool the background does not name: one clause says it was not yours and names the product you ran for that job, then the full answer in the present tense.
- Every control gets its limit. A fix or an incident closes on how you proved it held and what stops a repeat.
- Stay inside what was asked: a question about one product is answered from inside it, and the wider stack only if they ask.`,
  coding: `CODING INTERVIEW. When they ask you to write, fix, optimise or design code: (1) one sentence on your approach and its time and space complexity; (2) the code in ONE fenced block with the language tag (\`\`\`python) — complete and runnable, idiomatic, edge cases handled, meaningful names, no "..." or placeholder comments; (3) then say it like you would to the interviewer: how it works in 3-5 short sentences, the complexity, one edge case and how the code handles it, and one trade-off or alternative you would mention. Use the language they name; otherwise the one the background shows most. For a concept question with no code asked, answer in speech with a tiny snippet only if it clearly helps. Never invent an API, library function or flag — if unsure it exists, use plain language constructs. Talk about THIS code: never claim you wrote it before or tie it to a project, test suite, pipeline or tool unless the background shows exactly that.`,
  final: `FINAL ROUND (Architect, Director, Lead, Supervisor). Answer the question word for word: sentence one is the answer to exactly what they asked, in their terms. Then only what that question needs — the decision, the reason, the one fact that proves it. No preamble, no background they did not ask for, no second topic, no recap, no pitch. Every sentence must earn its place; stop when the question is answered.`,
}

function modeBlock(tier: number, question: string, interviewer: string): string {
  if (CODE_ASK_Q.test(question)) return MODE_BLOCKS.coding
  if (FINAL_INTERVIEWERS.has(interviewer)) return MODE_BLOCKS.final
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
}

// The lanes, in order: an explicit OpenRouter pick from the live screen first,
// then the primary, then the fallback model. Models on a long rate-limit block
// are skipped — a later request finds them cooled down.
function jobLanes(_job: AnswerJob): string[] { return [PAID_MODEL] }
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
async function streamAnswer(req: NextRequest, job: AnswerJob): Promise<Response> {
  const encoder = new TextEncoder()
  const startedAt = job.startedAt
  const metaBase = {
    engine: "marketfit",
    interviewer: job.interviewer,
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
      const timing = { first_ms: 0, lane: "", total_ms: 0 }
      let raw = ""
      let lastErr = ""
      let servedModel = ""
      let servedProvider = "openrouter"
      const onDelta = (d: string) => {
        if (!raw && d) timing.first_ms = Date.now() - startedAt
        raw += d
        emit({ type: "delta", text: d })
      }
      try {
        emit({ type: "meta", ...metaBase })
        if (job.orKey) {
          const runLane = async (model: string, tag: string) => {
            const began = Date.now()
            timing.lane += (timing.lane ? ">" : "") + `openrouter:${shortModel(model)}${tag}`
            try {
              const usage = await streamOpenRouter(job.orKey as string, model, job.system, job.userText, job.plan.maxTokens, onDelta, signal)
              servedModel = model
              lastErr = ""
              recordLane(model, true, usage, began)
            } catch (e) {
              lastErr = String((e as Error)?.message || e).slice(0, 200)
              recordLane(model, false, undefined, began, statusOf(lastErr))
            }
          }
          const attempt = async (tag: string) => {
            const { lanes, blockedNote } = openLanes(job)
            if (blockedNote && !lastErr) lastErr = blockedNote
            for (const m of lanes) { if (raw || signal.aborted) break; await runLane(m, tag) }
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
        let degraded = false
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
        const g = applyGuards(raw.trim(), job.guardFacts, job.allowed)
        const guardedText = g.text
        let finalText = voiceRepair(guardedText) || guardedText
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
        if (finalText !== raw) emit({ type: "replace", text: finalText })
        emit({
          type: "done", degraded, guarded: g.guarded, verified,
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
  let servedProvider = "openrouter"
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
  const g = applyGuards(raw.trim(), job.guardFacts, job.allowed)
  let out = voiceRepair(g.text) || g.text
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
  if (!out.trim()) return NextResponse.json({ error: "Nothing to answer." }, { status: 400, headers: NO_STORE })
  void lastErr
  return NextResponse.json({
    text: out,
    polished: true,
    degraded,
    guarded: g.guarded,
    verified,
    ledger: job.ledger,
    meta: {
      engine: "marketfit", provider: servedProvider, model: servedModel,
      interviewer: job.interviewer, tier: job.tier, kind: job.plan.kind, words: job.plan.words,
      routed: job.projectId,
    },
  }, { headers: NO_STORE })
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
  const uHash = hashUserId(user.id)
  let grounding = ""
  try { grounding = await dossierContext(uHash, "general") } catch { /* ungrounded answer is still an answer */ }

  // deriveOnly: the frontend asking "was that a question?" — cheapest first.
  // Gate 1 (code): speaker-aware — no Them: line and no ask pattern = no question.
  // Gate 2 (code): the transcript reduces to one clean question → extract verbatim.
  // Gate 3 (model): consolidated derivation with speaker labels.
  if (body.deriveOnly) {
    // The page sends the new speech as `question` and what was already answered as `transcript`.
    // Deriving from the earlier text is what answered "No question yet" while the question was the new speech.
    const heard = str(body.question, 5000)
    const earlier = str(body.transcript, 900)
    const heardQuestion = () => heard.split("\n").map((l) => l.replace(/^(?:You|Them):\s*/, "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 2000)
    if (!heard) return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    if (plainlyNoQuestion(heard))
      return NextResponse.json({ derived: heardQuestion(), derivedBy: "heard" }, { headers: NO_STORE })
    const clean = cleanQuestion(heard)
    if (clean) return NextResponse.json({ derived: clean, derivedBy: "code" }, { headers: NO_STORE })
    try {
      const { text } = await fetchOpenRouter(paidKey, PAID_MODEL, DERIVE_SYSTEM,
        `${earlier ? `EARLIER (already answered — context only):\n${earlier}\n\n` : ""}HEARD:\n${heard}`,
        500, AbortSignal.any([request.signal, AbortSignal.timeout(15000)]))
      const derived = text.trim()
      if (!derived || /^NO_QUESTION/i.test(derived))
        return NextResponse.json({ derived: heard.split("\n").map((l) => l.replace(/^(?:You|Them):\s*/, "").trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 2000), derivedBy: "heard" }, { headers: NO_STORE })
      return NextResponse.json({ derived }, { headers: NO_STORE })
    } catch {
      const said = heardQuestion()
      if (said) return NextResponse.json({ derived: said, derivedBy: "heard" }, { headers: NO_STORE })
      return NextResponse.json({ noQuestion: true }, { headers: NO_STORE })
    }
  }

  let question = str(body.derived, 4000) || str(body.question, 4000)
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
  const retrievedList = Array.isArray(body.retrieved)
    ? body.retrieved.map((r) => str(r, 500)).filter(Boolean)
    : []
  const retrieved = retrievedList.slice(0, 4).join("\n")

  // perfACT's answering intelligence: classify → tier rule → length plan.
  // A topic-less follow-up ("go deeper") is glued to the previous question in code.
  question = resolveFollowUp(question, historyArr.map((h) => {
    const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>
    return { q: str(o.q ?? o.question, 300) }
  }))
  const { tier, why } = classify(question)
  // Minimal intro triggers ("intro") get a canonical question so the model
  // generates a spoken self-introduction instead of echoing the trigger.
  question = canonicalQuestion(question, tier)
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

  // perfACT's resume intelligence: the resume is where the specifics live
  // (employer, tools, platforms). TF-IDF digest fitted to THIS question so
  // the model sees the right experience — a naive head-cut of a long resume
  // holds only the summary and skills, never the experience section.
  // Complements the dossier (the growing store); this is the fitted excerpt.
  const resumeText = str(config.resume, 12000)
  let resumeFacts = ""
  if (resumeText && resumeText.length > 200) {
    const rr = resumeRoles(resumeText)
    const aliasLines = employerAliases(
      rr.employers,
      `${question}\n${transcript}`,
    ).map(
      (a) => `SAME EMPLOYER: "${a.said}" (as said in this interview) is the resume's "${a.resume}" — you work there. Say "${a.said}".`,
    )
    const askForDigest = `${question}\n${transcript.slice(-600)}`
    const digest = resumeDigest(resumeText, askForDigest, plan.kind === "short" ? 1600 : 4600)
    resumeFacts = [
      rr.current ? `CURRENT ROLE (from the resume — use this exact title): ${rr.current}` : "",
      ...aliasLines,
      `RESUME (fitted to this question — every role, then the lines that match it):\n${digest}`,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const context = [
    `The interviewer is a ${interviewer} — pitch the technical depth to them.`,
    `QUESTION TYPE: ${why} (tier ${tier}). ${rule}`,
    `INTERVIEW MODE: ${modeBlock(tier, question, interviewer)}`,
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
    grounding ? `Real background (prefer over generic examples):\n${grounding.slice(0, 4500)}` : "",
    resumeFacts ? `${resumeFacts}` : "",
    transcript ? `Conversation so far:\n${transcript}` : "",
    history ? `Earlier in this interview:\n${history}` : "",
    retrieved ? `Retrieved notes:\n${retrieved}` : "",
  ].filter(Boolean).join("\n\n")

  // The vault decides which providers this feature may use (Admin → "Which AI
  // each feature uses"). OpenRouter lanes run only when the vault leaves the
  // key in; otherwise one vault-honoring call is made and delivered as SSE.
  const keys = rawKeys
  const fallbackText = retrievedList[0]
    || (prep.identity ? str(prep.identity, 600) : "")
    || "The answer engine is at its limit right now — press AI Answer again in a moment."
  // Grounding guards (perfACT anti-hallucination): the facts a claim may be
  // filled from (employer/title/known), the figures the answer may state, and
  // the source text for the optional post-generation fact-check.
  const resumeSrc = str(config.resume, 8000)
  const jdSrc = str(config.jd, 4000)
  const docsSrc = str(config.documents, 4000)
  const heardSrc = `${question}\n${transcript}`
  const guardFacts = speakFacts({
    resume: resumeSrc,
    jd: jdSrc,
    documents: docsSrc,
    heard: heardSrc,
    identity: str(prep.identity, 800),
    projects: str(prep.projects, 2000),
  })
  const allowed = allowedNumbers(resumeSrc, jdSrc, docsSrc, heardSrc, grounding)
  const figuresList = [...allowed].slice(0, 30)
  const figuresLine = `FIGURES: the ONLY result numbers you may state are these, from the candidate's own material: ${figuresList.length ? figuresList.join(", ") : "(none)"}. Never invent a count, percentage, duration or before/after figure — describe the change in words ("cut the queue to something the team could clear by lunch"). Technical constants (ports, versions, thresholds in a rule) are fine.`
  const factsText = [
    resumeSrc && `RESUME:\n${resumeSrc}`,
    jdSrc && `JOB DESCRIPTION:\n${jdSrc}`,
    docsSrc && `DOCUMENTS:\n${docsSrc}`,
    grounding && `BACKGROUND:\n${grounding.slice(0, 4000)}`,
  ].filter(Boolean).join("\n\n")
  const job: AnswerJob = {
    question,
    system: `${SYSTEM}\n\n${EVIDENCE_POLICY}\n\nAUDIENCE DELIVERY:\n${audienceGuidance(interviewer, question)}`,
    userText: `${context}\n\n${figuresLine}\n\nThe interviewer asked: "${question}"\n\nAnswer it as the candidate's spoken reply:`,
    plan,
    interviewer,
    tier,
    fallbackText,
    orKey: keys.openrouter || undefined,
    keys,
    liveModel: str(body.liveModel, 120),
    ledger,
    projectId,
    startedAt: Date.now(),
    guardFacts,
    allowed,
    factsText,
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
