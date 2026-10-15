import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { checkRateLimit } from "@/lib/rateLimit"
import { kompasReviewRuntime, coreCall, type LegacyModule } from "@/lib/kompasReviewRuntime"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// The original perfACT zero-model APIs kept as one native MarketFit route.
// Dedicated MarketFit answer, speech, questions and humanize endpoints win over
// this dynamic route; the strongest existing interview pipeline is untouched.
// Inputs are capped, server rules are source-identical to the browser and no
// provider keys or prompts are shipped into the client.
const supported = new Set(["pace", "score", "review", "practice", "lexicon"])
const NO_STORE = { "Cache-Control": "no-store" }
const text = (v: unknown, max: number) => typeof v === "string" ? v.slice(0, max) : ""
const number = (v: unknown, max: number) => Math.max(0, Math.min(max, Number(v) || 0))
type Args = { params: Promise<{ feature: string }> }
type Json = Record<string, unknown>
const json = (x: unknown, status = 200) => NextResponse.json(x, { status, headers: NO_STORE })

function oneScore(core: LegacyModule, x: Json) {
  return coreCall(core, "score", text(x.answer, 20000), {
    question: text(x.question, 600), resume: text(x.resume, 20000), about: x.about,
  })
}
function median(nums: number[]) {
  const values = nums.slice().sort((a, b) => a - b)
  return values.length ? values[Math.floor(values.length / 2)] : 0
}

export async function GET(request: NextRequest, { params }: Args) {
  const { feature } = await params
  if (!supported.has(feature)) return json({ error: "Unknown Kompas feature." }, 404)
  try {
    const { pace, score, review, lexicon, lexiconData } = await kompasReviewRuntime()
    if (feature === "pace") return json({ feature: "Pace", use: "POST { text, turn? }", model: "none", measured: pace.MEASURED, openers: pace.OPENERS })
    if (feature === "score") return json({
      feature: "Score", use: "POST { answer, question?, resume?, about? } or { answers: [{answer}] }",
      model: "none", measuredOn: score.VIDEOS, ruleShare: score.RULE_SHARE,
      rules: coreCall(score, "book"), limits: score.LIMIT, videos: score.VIDEOS,
    })
    if (feature === "review") return json({ feature: "What went wrong", use: "POST { text, me?, name?, detail? }", model: "none" })
    if (feature === "practice") return json({ feature: "Question Bank practice", use: "POST { answer, question?, category?, spokenSecs? }", model: "none" })
    const functions = lexiconData.functions as Record<string, { name: string; roles: string[]; terms: Array<{ w: string; s: string; k: string; hard?: boolean }> }>
    const termList = (names: string[]) => names.flatMap(k => (functions[k]?.terms || []).map(t => ({
      written: t.w, spoken: t.s, kind: t.k, function: k, ...(t.hard ? { hard: true } : {}),
    })))
    const fn = (request.nextUrl.searchParams.get("function") || "").slice(0, 100)
    const role = (request.nextUrl.searchParams.get("role") || "").slice(0, 160)
    if (fn) return functions[fn] ? json({
      function: fn, name: functions[fn].name, roles: functions[fn].roles,
      terms: termList([fn]), hints: coreCall(lexicon, "hints", [fn]),
    }) : json({ error: "No such function.", functions: Object.keys(functions) }, 404)
    if (role) {
      const fit = coreCall<Array<{ key: string; name: string }>>(lexicon, "functionsFor", role)
      const keys = fit.map(v => v.key)
      return json({ role, functions: fit, terms: termList(keys), hints: coreCall(lexicon, "hints", keys) })
    }
    return json({ feature: "Enterprise vocabulary", version: coreCall(lexicon, "version"),
      functions: coreCall(lexicon, "functions"), measured: coreCall(lexicon, "measured"),
      use: "GET ?function=<key> or ?role=<title>; POST {text, role?, functions?}", model: "none" })
  } catch {
    return json({ error: "Kompas rules are temporarily unavailable." }, 503)
  }
}

export async function POST(request: NextRequest, { params }: Args) {
  const { feature } = await params
  if (!supported.has(feature)) return json({ error: "Unknown Kompas feature." }, 404)
  const user = await authenticatedUser(request)
  if (!user) return json({ error: "Sign in again to use Kompas." }, 401)
  const limited = checkRateLimit(`kompas-native-${feature}:${user.id}`, { max: 90, windowMs: 60_000 })
  if (!limited.ok) return json({ error: "Wait a moment before trying again." }, 429)
  let body: Json
  try {
    const raw = await request.text()
    if (raw.length > 400_000) return json({ error: "That input is too large." }, 413)
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Send a JSON object." }, 400)
    body = parsed as Json
  } catch { return json({ error: "Send valid JSON." }, 400) }
  try {
    const { pace, score, review, lexicon, lexiconData } = await kompasReviewRuntime()
    const spend = { calls: 0, tokens: 0 }
    if (feature === "pace") {
      const original = text(body.text, 20000)
      if (!original.trim()) return json({ error: "Send the answer as { text }." }, 400)
      const turn = body.turn === undefined ? null : number(body.turn, 10000)
      const opener = turn === null ? "" : coreCall<string>(pace, "openerFor", original, turn)
      const said = opener ? coreCall<string>(pace, "opened", original, turn) : original
      return json({ said, opener, marked: coreCall(pace, "marked", said), units: coreCall(pace, "pace", said),
        report: coreCall(pace, "report", said), measured: pace.MEASURED, spend })
    }
    if (feature === "score") {
      const answers = Array.isArray(body.answers) ? body.answers : null
      if (answers) {
        if (!answers.length || answers.length > 50) return json({ error: "Send 1 to 50 answers." }, 400)
        const results = answers.map(row => oneScore(score, row && typeof row === "object" ? row as Json : {})) as Array<Record<string, unknown>>
        const judged = results.filter(x => x.enough)
        return json({ results, totals: {
          answers: results.length, judged: judged.length, passAll: judged.filter(x => x.passed === x.of).length,
          passedMedian: median(judged.map(x => Number(x.passed) || 0)),
          videosPass: { median: (score.VIDEOS as Json).passedMedian, of: (score.VIDEOS as Json).passedOf },
        }, spend })
      }
      if (!text(body.answer, 20000).trim()) return json({ error: "Send the answer as { answer }." }, 400)
      return json({ ...oneScore(score, body) as Json, spend })
    }
    if (feature === "practice") {
      const answer = text(body.answer, 20000)
      const output = coreCall<Json>(review, "practice", answer, text(body.category, 40), number(body.spokenSecs, 86400), text(body.question, 600))
      const m = answer.trim() ? coreCall<Json>(review, "measure", answer.trim()) : null
      return json({ ...output, measured: m ? {
        words: m.words, fillers: m.fillers, hedges: m.hedges,
        longSentences: Array.isArray(m.long) ? m.long.length : 0, longest: m.longest, weakOpening: m.weakOpen,
      } : null, spend })
    }
    if (feature === "review") {
      const original = text(body.text || body.transcript, 300_000)
      if (!original.trim()) return json({ count: 0, outcomes: {}, sessions: [], error: "Send the transcript as text." })
      const sessions = coreCall<Array<{ outcome: string }>>(review, "review", original, {
        me: text(body.me, 100), name: text(body.name, 120),
        detail: body.detail === "summary" ? "summary" : "full",
        limit: number(body.limit, 100), title: text(body.title, 160),
      })
      const outcomes: Record<string, number> = {}
      for (const session of sessions) outcomes[session.outcome] = (outcomes[session.outcome] || 0) + 1
      return json({ count: sessions.length, outcomes, sessions,
        jev: { mode: "off", reason: "The original zero-model review rules are enabled; optional Jev shadow checks require explicit configuration." }, spend })
    }
    const textValue = text(body.text, 300_001)
    if (!textValue.trim()) return json({ text: "", changes: [], maybe: [], error: "Send transcript text." })
    if (textValue.length > 300_000) return json({ text: textValue, changes: [], maybe: [], error: "Send the text in parts." })
    const funcs = (lexiconData.functions || {}) as Record<string, { name: string }>
    const given = (Array.isArray(body.functions) ? body.functions : [])
      .filter((k): k is string => typeof k === "string" && Object.prototype.hasOwnProperty.call(funcs, k))
    const fit = given.length ? given.map(k => ({ key: k, name: funcs[k].name }))
      : body.role ? coreCall<Array<{ key: string; name: string }>>(lexicon, "functionsFor", text(body.role, 160)) : []
    return json({ ...coreCall<Json>(lexicon, "canonicalize", textValue, fit.map(f => f.key)), functions: fit,
      ...(fit.length ? {} : { note: "Role was not provided; only universal safe spellings were corrected." }) })
  } catch {
    return json({ error: "Kompas rules are temporarily unavailable." }, 503)
  }
}
