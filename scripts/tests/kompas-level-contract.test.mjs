// Five fixed questions at three levels, through the real /api/answer route.
// Providers return a short line. The level contract extends or trims once.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { posix } from "node:path"
import { runInNewContext } from "node:vm"
import ts from "typescript"
import { BANNED_HEDGE, CANNED_FILLER, fitLevelAnswer, hasJargonList, hasRepeatedSentence, isQuickQuestion, levelContract, wordCount } from "../../src/lib/kompasLevelContract.ts"

const require = createRequire(import.meta.url)
const root = new URL("../../", import.meta.url)
const SHORT = "I would keep the work on the resume and say what I actually did."

function loadRoute() {
  const models = []
  const mocks = {
    "@/lib/llm": {
      keysFor: async () => ({ openrouter: "test-key", groq: "groq-test" }),
      resolveKeys: () => ({ openrouter: "test-key", groq: "groq-test" }),
    },
    "@/lib/llmLedger": { scheduleLlmRecord: () => {} },
    "@/lib/dossier": { dossierContext: async () => "" },
    "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
  }
  const cache = new Map()
  function load(rel) {
    if (cache.has(rel)) return cache.get(rel)
    const module = { exports: {} }
    cache.set(rel, module.exports)
    const js = ts.transpileModule(readFileSync(new URL(rel, root), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText
    runInNewContext(js, {
      module, exports: module.exports, process: { env: {} }, console,
      setTimeout, clearTimeout, AbortController, AbortSignal, Response, TextEncoder, TextDecoder, ReadableStream, URL, Headers,
      fetch: async (url, options) => {
        const body = JSON.parse(options.body)
        if (String(url).includes("groq.com")) return Response.json({ choices: [{ message: { content: SHORT } }] })
        models.push({ model: body.model, maxTokens: body.max_tokens || 0 })
        const user = (body.messages || []).map((m) => m.content).join("\n")
        const named = user.match(/about (\d+) words/)
        const target = named ? Number(named[1]) : Math.max(40, Math.round(((body.max_tokens || 800) - 500) / 2.6))
        const lines = []
        let count = 0
        let i = 0
        while (count < target && i < 90) {
          const line = `On step ${i + 1} for target ${target} I check the live control, name who owns it, and write the next step before I move on.`
          lines.push(line)
          count += line.split(/\s+/).length
          i += 1
        }
        return Response.json({ choices: [{ message: { content: lines.join(" ") } }], usage: { prompt_tokens: 8, completion_tokens: count } })
      },
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
  const { NextRequest } = require("next/server")
  return {
    models,
    post(body) {
      return route.POST(new NextRequest("https://job-dashboard-fawn.vercel.app/api/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }))
    },
  }
}

const TYPICAL = [
  "Tell me about yourself.",
  "Tell me about a time you handled an incident.",
  "How would you design certificate issuance and revocation?",
  "Walk me through how you rolled out a security control.",
  "Describe a time you had to explain a risk to someone outside the security team.",
]
const QUICK = "What does PKI stand for?"

test("typical questions scale Architect, Engineer, then Director", () => {
  for (const question of TYPICAL) {
    assert.equal(isQuickQuestion(question), false, question)
    const architect = levelContract("architect", question)
    const engineer = levelContract("engineer", question)
    const director = levelContract("director", question)
    assert.ok(architect.target > engineer.target && engineer.target > director.target)
    assert.ok(engineer.target / architect.target >= 0.6 && engineer.target / architect.target <= 0.9)
    assert.ok(director.target / architect.target >= 0.4 && director.target / architect.target <= 0.65)
    assert.ok(architect.target >= 1000, `${question} ${architect.target}`)
    assert.ok(engineer.target >= 700 && engineer.target <= 800, `${question} ${engineer.target}`)
    assert.ok(director.target >= 400 && director.target <= 600, `${question} ${director.target}`)
    assert.ok(architect.maxTokens >= architect.target * 2)
  }
  const quick = levelContract("architect", QUICK)
  assert.ok(quick.quick)
  assert.ok(quick.target < 1000)
  assert.ok(levelContract("engineer", QUICK).target / quick.target >= 0.6)
  assert.ok(levelContract("director", QUICK).target / quick.target >= 0.4)
})

test("a top-level level is kept and a missing resume does not claim it is unloaded", { timeout: 60000 }, async () => {
  const route = loadRoute()
  for (const level of ["architect", "director", "engineer"]) {
    const response = await route.post({
      question: "Describe a time you set up CyberArk PAM from scratch. What were your responsibilities?",
      level,
    })
    const body = await response.json()
    const text = String(body.text || "")
    assert.equal(response.status, 200, JSON.stringify(body).slice(0, 200))
    assert.equal(body.meta.level, level)
    assert.equal(body.meta.interviewer, level)
    assert.equal(body.resumeState, "grounded")
    assert.doesNotMatch(text, CANNED_FILLER)
    assert.doesNotMatch(text, /don't have my resume loaded/i)
    assert.equal(hasRepeatedSentence(text), false)
    assert.equal(hasJargonList(text), false)
  }
})

test("an introduction cannot name an employer that is not on the loaded resume", async () => {
  const { dropUnknownEmployers } = await import("../../src/lib/kompasResume.ts")
  const { HOUSTON_RESUME } = await import("../../src/lib/kompasHonestyGate.ts")
  const invented = "I am a Senior IAM Engineer at Saviynt. I started at Accenture as a Junior IAM Engineer, then Charter Communications. I lead FortiGate-VM deployments across AWS."
  const out = dropUnknownEmployers(invented, HOUSTON_RESUME)
  assert.doesNotMatch(out, /Saviynt|Accenture|Charter/)
  assert.match(out, /FortiGate|Fortinet/)
  assert.doesNotMatch(out, /jayeshwar44/i)
})

test("a generated answer cannot hedge or use the stock closer", () => {
  const banned = [
    "I've had less direct hands-on with Saviynt; my Sr work transfers because it is the same kind of work.",
    "I have less experience with that tool.",
    "Not directly, but I can speak to the work.",
    "I haven't used that.",
    "I don't have my resume loaded here, so hypothetically.",
    "I own the decision, and I say it in words anyone in the operation can use.",
    "The outcome I am responsible for is that the work keeps moving and the risk we accepted is named.",
    "I do not walk the build.",
    "I say what I chose, why that choice protects the business.",
    "The point is the result, said once, with the responsibility sitting on me.",
  ].join(" ")
  const text = fitLevelAnswer(`I rotated the key in the vault. ${banned}`, levelContract("director", "Tell me about a time you handled an IAM problem."))
  assert.match(text, /rotated the key/)
  assert.doesNotMatch(text, BANNED_HEDGE)
  assert.doesNotMatch(text, /walk the build|words anyone|said once/)
})

test("director padding is removed", () => {
  const text = fitLevelAnswer("I own the cutover. I do not walk the build. I say what I chose and why. The point is the result, said once.", levelContract("director", "Tell me about yourself."))
  assert.doesNotMatch(text, /I do not walk the build|The point is the result|I say what I chose/)
  assert.match(text, /cutover/)
})

test("a short answer is not padded with a repeated filler sentence", () => {
  const filler = "In plain terms, the reason I work it this way is that the person listening should be able to follow the thought without a manual. "
  const text = fitLevelAnswer(filler.repeat(5), levelContract("architect", "Describe a time you set up CyberArk PAM from scratch. What were your responsibilities?"))
  assert.equal(hasRepeatedSentence(text), false)
  assert.doesNotMatch(text, CANNED_FILLER)
  assert.ok(wordCount(text) < 40)
})
