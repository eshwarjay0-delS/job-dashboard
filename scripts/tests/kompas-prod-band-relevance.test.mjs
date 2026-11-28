// Production answer path (28 Nov 2026): the request the live /kompas page sends (stream: true, config from the session,
// level from the level menu, packId of the Role/Category, consolidated heard text on the live path) through the real
// /api/answer route. The model is a stub: the first pass answers short and only the first part of a two-part ask.
// Locks in: every level lands in its band (Architect 1000+, Engineer 700-800, Director 400-600), every part of the
// question is answered with the first part first, a spoken "explain how X works" is not a 40-160 word fact, the live
// "Can you tell me ...? What do you ...?" keeps both parts, and a failed continuation on the first model still fills the band.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { posix } from "node:path"
import { runInNewContext } from "node:vm"
import ts from "typescript"
import { relevanceReport, questionParts, contentKeys } from "../../src/lib/kompasAnswerParts.ts"
import { isQuickQuestion, levelContract } from "../../src/lib/kompasLevelContract.ts"
import { assembleQuestionWindow } from "../../src/lib/kompasQuestionWindow.ts"

const require = createRequire(import.meta.url)
const root = new URL("../../", import.meta.url)
const BAND = { architect: [1000, 1400], engineer: [700, 800], director: [400, 600] }
const PAID = "meta-llama/llama-3.3-70b-instruct"

const VERBS = ["checked", "traced", "compared", "documented", "confirmed", "mapped", "reviewed", "tested", "tuned", "escalated", "closed", "verified", "measured", "grouped", "ranked", "queried", "isolated", "rebuilt", "assigned", "reported"]
const NOUNS = ["the notable", "the host timeline", "the account history", "the parent process", "the proxy record", "the firewall deny", "the ticket notes", "the owner list", "the change record", "the scan result", "the patch window", "the asset tag", "the lookup table", "the saved search", "the runbook step", "the closure note", "the handoff", "the queue", "the dashboard panel", "the evidence folder"]
const PLACES = ["At Citi Bank", "At CVS Health", "At Charter Communications", "At Accenture", "At the City of San Diego"]
let serial = 0
let TOPIC = []
function sentences(n, lead = "") {
  const out = lead ? [lead] : []
  let words = lead ? lead.split(/\s+/).length : 0
  while (words < n) {
    const i = serial++
    const t = TOPIC.length ? `${TOPIC[i % TOPIC.length]} ${TOPIC[(i + 1) % TOPIC.length]}` : "alert"
    const s = `${PLACES[i % 5]} I ${VERBS[i % 20]} ${NOUNS[Math.floor(i / 20) % 20]} for the ${t} work and then ${VERBS[(i + 7) % 20]} ${NOUNS[(i + Math.floor(i / 20) + 3) % 20]} before the ${["morning", "evening", "weekend", "overnight", "quarterly"][i % 5]} ${["review", "handoff", "standup", "audit", "readout"][Math.floor(i / 400) % 5]}.`
    out.push(s)
    words += s.split(/\s+/).length
  }
  return out.join(" ")
}
function partLead(part) {
  const keys = part.text.replace(/[?]/g, "").split(/\s+/).filter((w) => contentKeys(w).length).slice(0, 6).join(" ")
  return `I answer that directly: ${keys}.`
}

function loadRoute(opts = {}) {
  const calls = []
  // Filler talks only about the first asked part, so a later part is answered only when the service asks for it.
  TOPIC = String((questionParts(opts.question || "")[0] || {}).text || "").replace(/[?.,]/g, " ").split(/\s+/).filter((w) => w.length > 4 && contentKeys(w).length).slice(0, 8)
  const mocks = {
    "@/lib/llm": {
      keysFor: async () => ({ openrouter: "test-key", ...(opts.direct ? { anthropic: "direct-key" } : {}) }),
      resolveKeys: () => ({ openrouter: "test-key", ...(opts.direct ? { anthropic: "direct-key" } : {}) }),
      callLLM: async (req) => {
        if (!opts.direct) throw new Error("no direct provider in this test")
        const user = String(req.user || "")
        const continuation = /Continue this spoken answer|Add new spoken sentences/.test(user)
        calls.push({ model: "direct", stream: false, continuation, user })
        if (!continuation) {
          const parts = questionParts(opts.question || "")
          return { text: sentences(opts.firstWords || 120, parts[0] ? partLead(parts[0]) : ""), model: "direct", provider: "anthropic" }
        }
        const want = Number((user.match(/about (\d+) more words/) || [])[1] || 120)
        const gap = (user.match(/(?:has not yet answered|has not answered yet): "([^"]+)"/) || [])[1]
        return { text: sentences(want, gap ? partLead({ text: gap }) : ""), model: "direct", provider: "anthropic" }
      },
      callOpenAI: async () => { throw new Error("no openai in this test") },
      modelFor: () => "stub",
    },
    "@/lib/llmLedger": { scheduleLlmRecord: () => {} },
    "@/lib/dossier": { dossierContext: async () => "" },
    "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
  }
  const cache = new Map()
  const fetch = async (url, options) => {
    if (opts.allStatus) return new Response("credits", { status: opts.allStatus })
    if (opts.timeout) { const err = new Error("The operation was aborted"); err.name = "AbortError"; throw err }
    const body = JSON.parse(options.body)
    const user = (body.messages || []).filter((m) => m.role === "user").map((m) => m.content).join("\n")
    const continuation = /Continue this spoken answer|Add new spoken sentences/.test(user)
    calls.push({ model: body.model, stream: !!body.stream, continuation, user })
    if (continuation && opts.allContinuationStatus) return new Response("credits", { status: opts.allContinuationStatus })
    if (continuation && opts.paidContinuationStatus && body.model === PAID) return new Response("credits", { status: opts.paidContinuationStatus })
    if (body.stream) {
      // First pass: short, and only the first asked part.
      const q = (user.match(/(?:^|\n)(?:QUESTION|CURRENT QUESTION|Question)[^:\n]*:\s*([^\n]+)/) || [])[1] || opts.question || ""
      const parts = questionParts(opts.question || q)
      const text = sentences(opts.firstWords || 120, parts[0] ? partLead(parts[0]) : "")
      const enc = new TextEncoder()
      const chunks = [`TITLE: ${String(opts.question || "Answer").slice(0, 40)}\n`, ...text.match(/.{1,80}/gs)]
      const stream = new ReadableStream({
        start(c) {
          for (const piece of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`))
          c.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 9, completion_tokens: 99 } })}\n\n`))
          c.enqueue(enc.encode("data: [DONE]\n\n"))
          c.close()
        },
      })
      return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })
    }
    if (continuation) {
      const want = Number((user.match(/about (\d+) more words/) || [])[1] || 120)
      const gap = (user.match(/(?:has not yet answered|has not answered yet): "([^"]+)"/) || [])[1]
      return Response.json({ choices: [{ message: { content: sentences(want, gap ? partLead({ text: gap }) : "") } }], usage: { prompt_tokens: 9, completion_tokens: want } })
    }
    // Any other helper call (structure repair, verification): hand back the answer it was given.
    const so = (user.match(/ANSWER(?: SO FAR)?:\n([\s\S]+)$/) || [])[1]
    return Response.json({ choices: [{ message: { content: so || "" } }], usage: { prompt_tokens: 9, completion_tokens: 9 } })
  }
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const module = { exports: {} }
    cache.set(rel, module.exports)
    const js = ts.transpileModule(readFileSync(new URL(rel, root), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    runInNewContext(js, {
      module, exports: module.exports, process: { env: {} }, console: { ...console, log() {}, info() {} },
      setTimeout, clearTimeout, setInterval, clearInterval, AbortController, AbortSignal, Response, TextEncoder, TextDecoder, ReadableStream, URL, Headers, fetch,
      require: (id) => {
        if (mocks[id]) return mocks[id]
        if (id.startsWith("@/")) return load("src/" + id.slice(2) + ".ts")
        if (id.startsWith(".")) {
          const base = posix.normalize(posix.join(posix.dirname(rel), id))
          for (const candidate of [base, base + ".ts", base + ".tsx", base + ".js"]) {
            try { readFileSync(new URL(candidate, root)); return load(candidate) } catch { /* next */ }
          }
          return load(base + ".ts")
        }
        return require(id)
      },
    }, { filename: rel })
    return module.exports
  }
  const route = load("src/app/api/answer/route.ts")
  const packs = load("src/lib/kompasPacks/index.ts")
  const { NextRequest } = require("next/server")
  return {
    calls,
    async ask({ question, level, packId = "soc-analyst", live = false, heard = "" }) {
      const pack = packs.getPack(packId) || {}
      const writeAnchor = level === "architect" ? "director" : level
      const body = {
        stream: true, client: "kompas-web", consolidated: live, question: live ? heard : question, derived: question, pinned: true, again: false,
        packId, notebookLmUrl: "", packNotes: [], transcript: "",
        config: { company: "Practice", role: pack.title || "", jd: String(pack.dossier || "").slice(0, 8000), resume: String(packs.OWNER_RESUME), documents: "", instructions: "", language: "en",
          format: "full_script", length: "balanced", tone: "simple", star: false, mode: "technical", interviewer: writeAnchor, difficulty: "standard", level },
        prep: {}, retrieved: [], ledger: [], history: [],
      }
      const res = await route.POST(new NextRequest("https://marketfit-app.vercel.app/api/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))
      const raw = await res.text()
      let text = ""
      for (const block of raw.split("\n\n")) {
        const line = block.split("\n").find((l) => l.startsWith("data: "))
        if (!line) continue
        let ev; try { ev = JSON.parse(line.slice(6)) } catch { continue }
        if (ev.type === "delta") text += ev.text
        if (ev.type === "replace") text = ev.text
        if (ev.type === "done" && ev.text && !text) text = ev.text
      }
      return { status: res.status, text: text.trim(), words: text.trim().split(/\s+/).filter(Boolean).length }
    },
  }
}

function inBand(level, words) {
  const [lo, hi] = BAND[level]
  return words >= lo && words <= hi
}

test("spoken explain/tell-me asks and two-part asks are never the quick 40-160 word band", () => {
  for (const q of ["Can you explain to me how Sentinel works?", "Can you tell me how your day-to-day looks?", "How does the dashboard look? What can you see?", "Describe your escalation process."]) {
    assert.equal(isQuickQuestion(q), false, q)
    assert.ok(levelContract("engineer", q).min >= 700, q)
  }
  assert.equal(isQuickQuestion("What does PKI stand for?"), true)
})

test("the live two-part ask keeps both parts in one question window", () => {
  const w = assembleQuestionWindow("Okay. Got it. Can you tell me how your dayto-day uh life looks like as a sock analyst? What do you start with on a day?")
  assert.match(w.text, /day-?to-?day|dayto-day/i)
  assert.match(w.text, /start with on a day/i)
  const lone = assembleQuestionWindow("Can you explain how Sentinel works? What do you know about SQL injection?")
  assert.doesNotMatch(lone.text, /Sentinel/)
})

const TYPED = [
  { level: "engineer", packId: "soc-analyst", question: "Can you explain how you use Splunk for incident detection and response in your daily work as a SOC Analyst L2?" },
  { level: "director", packId: "vulnerability-management", question: "Can you describe a scenario where a rescan did not yield the expected results? What actions did you take afterward?" },
  { level: "architect", packId: "incident-response", question: "Imagine you receive an alert about a potential data breach. What steps would you take to contain the incident and preserve evidence?" },
  { level: "engineer", packId: "iam-engineer", question: "Describe a situation where you had to handle a complex joiner or mover scenario. What steps did you take to ensure proper access management?" },
  { level: "director", packId: "appsec-engineer", question: "What steps do you take to ensure that findings assigned to developers are tracked effectively? How do you handle situations where developers are unresponsive?" },
  { level: "architect", packId: "cloud-security", question: "Share an experience where you had to verify controls after a change in Azure. What was your approach, and what tools did you use?" },
]

test("typed Role and Category questions land in the level band and answer every part, first part first", { timeout: 120000 }, async () => {
  for (const item of TYPED) {
    const route = loadRoute({ question: item.question })
    const r = await route.ask(item)
    assert.equal(r.status, 200)
    assert.ok(inBand(item.level, r.words), `${item.level} ${r.words} words: ${item.question}`)
    const rel = relevanceReport(item.question, r.text)
    assert.equal(rel.pass, true, `${item.question} -> ${JSON.stringify(rel)}`)
  }
})

test("a 402 on the first model's continuation still fills the band from the second model", { timeout: 60000 }, async () => {
  const item = TYPED[0]
  const route = loadRoute({ question: item.question, paidContinuationStatus: 402 })
  const r = await route.ask(item)
  assert.ok(inBand(item.level, r.words), `${r.words} words`)
  assert.ok(route.calls.some((c) => c.continuation && c.model !== PAID), "continuation retried on the second model")
})

test("video-2 live asks through the consolidated path keep both parts and the Engineer band", { timeout: 60000 }, async () => {
  for (const heard of [
    "Them: Okay. Got it. Can you tell me how your dayto-day uh life looks like as a sock analyst? What do you start with on a day?",
    "Them: Okay. All right. And uh can you explain to me how Sentinel works?",
  ]) {
    const question = heard.replace(/^Them:\s*/, "")
    const route = loadRoute({ question })
    const r = await route.ask({ question, heard, level: "engineer", live: true })
    const first = route.calls.find((c) => c.stream)
    assert.ok(first, "the model was called")
    if (/day/i.test(question)) {
      assert.match(first.user, /day-?to-?day|dayto-day|day to day/i)
      assert.match(first.user, /start with/i)
    }
    assert.ok(inBand("engineer", r.words), `${r.words} words: ${question}`)
    assert.equal(relevanceReport(question, r.text).pass, true, question)
  }
})

test("when every OpenRouter continuation fails (402), the direct provider continues to the band, never the stock block", { timeout: 60000 }, async () => {
  for (const item of [TYPED[0], TYPED[1]]) {
    const route = loadRoute({ question: item.question, direct: true, allContinuationStatus: 402 })
    const r = await route.ask(item)
    assert.ok(inBand(item.level, r.words), `${item.level} ${r.words} words`)
    assert.doesNotMatch(r.text, /search updated so it pages once|At Citi I caught a privileged sign-in in Splunk that did not match the change window/)
    assert.ok(route.calls.some((c) => c.model === "direct" && c.continuation), "direct continuation ran")
    assert.equal(relevanceReport(item.question, r.text).pass, true, item.question)
  }
})

test("a 402 on every OpenRouter call still yields the level band, and a timeout still yields text", { timeout: 120000 }, async () => {
  const architect = TYPED[2]
  const blocked = loadRoute({ question: architect.question, allStatus: 402 })
  const filled = await blocked.ask(architect)
  assert.equal(filled.status, 200)
  assert.ok(filled.words >= 1000, `architect ${filled.words} words after 402`)
  assert.doesNotMatch(filled.text, /Story\s+\d+:|only when the question needs|pages once|\bby %\b|protects typed privileged accounts|Press Start — answers appear here/i)
  assert.doesNotMatch(filled.text, /Initech|PhantomSIEM|jayeshwar44/)
  const engineer = TYPED[0]
  const timed = loadRoute({ question: engineer.question, timeout: true })
  const kept = await timed.ask(engineer)
  assert.ok(kept.words >= 40, `timeout left ${kept.words} words`)
  assert.doesNotMatch(kept.text, /^$/)
})

test("video-2 escalate, SQL injection, and Sentinel get full Engineer answers, not stubs", { timeout: 60000 }, async () => {
  for (const heard of [
    "Them: at what instant you will escalate",
    "Them: Okay. And what do you know about SQL injection?",
    "Them: Okay. And do you know about cross-sight scripting XSS?",
    "Them: Okay. All right. And uh can you explain to me how Sentinel works?",
  ]) {
    const question = heard.replace(/^Them:\s*/, "")
    const route = loadRoute({ question })
    const r = await route.ask({ question, heard, level: "engineer", live: true })
    assert.ok(r.words >= 700 && r.words <= 800, `${r.words} words: ${question}`)
    assert.doesNotMatch(r.text, /^I know about [\w\s-]+\.?$/i)
    assert.doesNotMatch(r.text, /haven(?:'|’)t worked directly with/i)
  }
})
