// Five fixed questions at three levels, through the real /api/answer route.
// Providers return a short line. The level contract extends or trims once.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { posix } from "node:path"
import { runInNewContext } from "node:vm"
import ts from "typescript"
import { hasJargonList, hasPlainReasoning, isQuickQuestion, levelContract, wordCount } from "../../src/lib/kompasLevelContract.ts"

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
        return Response.json({ choices: [{ message: { content: SHORT } }], usage: { prompt_tokens: 8, completion_tokens: 16 } })
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

async function ask(route, question, level) {
  const response = await route.post({
    question,
    config: { interviewer: level, level, length: "balanced", resume: "Senior security engineer. Certificate issuance, revocation, and incident response." },
  })
  const body = await response.json()
  assert.equal(response.status, 200, question + " " + level + " " + JSON.stringify(body).slice(0, 180))
  const text = String(body.text || "")
  const n = wordCount(text)
  const band = levelContract(level, question)
  assert.ok(Math.abs(n - band.target) / band.target <= 0.2, `${level} ${question} ${n} is not within 20% of ${band.target}`)
  assert.ok(n >= band.min && n <= band.max, `${level} ${question} ${n} not in ${band.min}-${band.max}`)
  if (level === "director") assert.equal(hasJargonList(text), false, question)
  if (level === "engineer") assert.equal(hasPlainReasoning(text), true, question)
  assert.doesNotMatch(text, /^#{1,3}\s|^\s*(?:Design|Components|Trade-offs|Risks):/m)
  assert.ok(route.models.some((call) => call.maxTokens >= band.target * 2), `${level} max_tokens ${JSON.stringify(route.models.slice(-4))}`)
  route.models.length = 0
  return n
}

test("five typical questions keep Architect above Engineer above Director", { timeout: 180000 }, async () => {
  const route = loadRoute()
  for (const question of TYPICAL) {
    assert.equal(isQuickQuestion(question), false, question)
    const architect = await ask(route, question, "architect")
    const engineer = await ask(route, question, "engineer")
    const director = await ask(route, question, "director")
    assert.ok(architect > engineer && engineer > director, `${question} ${architect} ${engineer} ${director}`)
    const engineerRatio = engineer / architect
    const directorRatio = director / architect
    assert.ok(engineerRatio >= 0.6 && engineerRatio <= 0.9, `${question} engineer/architect ${engineerRatio}`)
    assert.ok(directorRatio >= 0.4 && directorRatio <= 0.65, `${question} director/architect ${directorRatio}`)
    const architectTarget = levelContract("architect", question).target
    const engineerTarget = levelContract("engineer", question).target
    const directorTarget = levelContract("director", question).target
    assert.ok(architectTarget >= 1000, `${question} architect target ${architectTarget}`)
    assert.ok(engineerTarget >= 700 && engineerTarget <= 800, `${question} engineer target ${engineerTarget}`)
    assert.ok(directorTarget >= 400 && directorTarget <= 600, `${question} director target ${directorTarget}`)
  }
  const architect = await ask(route, QUICK, "architect")
  const engineer = await ask(route, QUICK, "engineer")
  const director = await ask(route, QUICK, "director")
  assert.ok(architect > engineer && engineer > director)
  assert.ok(engineer / architect >= 0.6 && engineer / architect <= 0.9)
  assert.ok(director / architect >= 0.4 && director / architect <= 0.65)
  assert.ok(architect < 1000, "a quick fact stays shorter than a typical Architect answer")
})
