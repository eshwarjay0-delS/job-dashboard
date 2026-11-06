// Kompas JEV route table: question class + retrieval confidence → go / confirm / stop.
// Offline. No TypeSafe Jev, no model, no network. The live answer card is the confirm surface.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { posix } from "node:path"
import { runInNewContext } from "node:vm"
import ts from "typescript"
import { SPOKEN_BLANK } from "../../src/lib/kompasPivot.ts"
import { interviewIntent } from "../../src/lib/kompasRelevance.ts"
import { questionDepth } from "../../src/lib/kompasAnswer.ts"
import { sourceDocs, retrievePassages } from "../../src/lib/kompasSourceRetrieval.ts"
import {
  CONFIRM_LINE, JEV_ROUTE_TABLE, retrievalConfidence, routeAnswer,
} from "../../src/lib/kompasJevRoute.ts"

const CLASSES = [
  "introduction", "closing-question", "acknowledgement", "value", "experience-story",
  "comparison", "definition", "scenario", "technical-process", "logistics", "follow-up", "direct",
]
const BANDS = ["high", "mid", "low", "none"]
const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const DOCS = sourceDocs({ resume: S.resume, jd: S.jd, dossier: S.dossier, savedQA: S.savedQA })

function expectAction(questionClass, confidence, confirmSurface, outOfLane) {
  if (outOfLane) return "stop"
  if (questionClass === "experience-story" && confidence === "mid" && confirmSurface) return "confirm"
  return "go"
}

test("the confirm line is the spoken blank the product already uses", () => {
  assert.equal(CONFIRM_LINE, "I would want to confirm that")
  assert.equal(CONFIRM_LINE, SPOKEN_BLANK.replace(/^"|"$/g, ""))
  assert.equal(JEV_ROUTE_TABLE.some((row) => row.action === "go"), true)
  assert.equal(JEV_ROUTE_TABLE.some((row) => row.action === "confirm"), true)
  assert.equal(JEV_ROUTE_TABLE.some((row) => row.action === "stop"), true)
})

test("confidence bands follow the existing coverage gate, not the fallback closest line", () => {
  assert.equal(retrievalConfidence(null), "none")
  assert.equal(retrievalConfidence({ matched: false, all: [] }), "none")
  assert.equal(retrievalConfidence({ matched: true, all: [{ score: 2 }] }), "high")
  assert.equal(retrievalConfidence({ matched: true, missing: [], all: [{ score: 2 }] }), "high")
  assert.equal(retrievalConfidence({ matched: true, missing: ["Kubernetes"], all: [{ score: 2 }] }), "mid")
  assert.equal(retrievalConfidence({ matched: false, all: [{ score: 0.4 }, { score: 0 }] }), "mid")
  assert.equal(retrievalConfidence({ matched: false, all: [{ score: 0 }, { score: 0 }] }), "low")
})

test("go, confirm, and stop cover class, band, surface, and the personal-logistics lane", () => {
  for (const questionClass of CLASSES) {
    for (const confidence of BANDS) {
      for (const confirmSurface of [true, false]) {
        for (const outOfLane of [true, false]) {
          const lane = routeAnswer({
            question: confidence === "none" ? "" : "How did you rotate the leaked API key across the cluster?",
            questionClass,
            confidence,
            confirmSurface,
            outOfLane,
            audience: "director",
          })
          const action = expectAction(questionClass, confidence, confirmSurface, outOfLane)
          assert.equal(lane.action, action, `${questionClass} ${confidence} surface=${confirmSurface} lane=${outOfLane}`)
          assert.equal(lane.callModel, action === "go")
          assert.equal(lane.questionClass, questionClass)
          assert.equal(lane.confidence, confidence)
          assert.equal(lane.audience, "director")
          assert.equal(lane.confirmLine, CONFIRM_LINE)
          assert.equal(lane.jevCalled, undefined)
          if (outOfLane) assert.equal(lane.reason, "out-of-lane")
          else if (action === "confirm") assert.equal(lane.reason, "confirm")
          else assert.equal(lane.reason, "clear")
        }
      }
    }
  }
})

test("a logistics label from the broad classifier is not a stop unless the personal strip cleared the ask", () => {
  const technical = routeAnswer({
    question: "Walk me through your hybrid cloud migration.",
    questionClass: "logistics",
    confidence: "mid",
    confirmSurface: true,
    outOfLane: false,
  })
  assert.equal(interviewIntent("Walk me through your hybrid cloud migration."), "logistics")
  assert.equal(technical.action, "go")
  assert.equal(technical.callModel, true)
  const personal = routeAnswer({
    question: "What is your home address?",
    questionClass: "logistics",
    confidence: "high",
    confirmSurface: true,
    outOfLane: true,
  })
  assert.equal(personal.action, "stop")
  assert.equal(personal.reason, "out-of-lane")
  assert.equal(personal.callModel, false)
})

test("depth is the existing questionDepth read, and audience defaults to the engineer listener", () => {
  const surfaceQuestion = "What is DNS?"
  const deepQuestion = "How did you troubleshoot the TLS failure across the cluster environment, and what was the tradeoff?"
  const surface = routeAnswer({ question: surfaceQuestion, questionClass: "definition", confidence: "low" })
  const deep = routeAnswer({
    question: deepQuestion,
    questionClass: "technical-process",
    confidence: "low",
    audience: "architect",
  })
  assert.equal(surface.depth, questionDepth(surfaceQuestion))
  assert.equal(deep.depth, questionDepth(deepQuestion))
  assert.ok(deep.depth > surface.depth)
  assert.equal(surface.audience, "engineer")
  assert.equal(deep.audience, "architect")
})

test("sample sources: a covered story goes, a lexical miss still goes, a split story confirms", () => {
  const covered = retrievePassages("Tell me about a time you handled a leaked API key.", DOCS)
  const coveredLane = routeAnswer({
    question: "Tell me about a time you handled a leaked API key.",
    questionClass: interviewIntent("Tell me about a time you handled a leaked API key."),
    retrieval: covered,
    confirmSurface: true,
  })
  assert.equal(coveredLane.questionClass, "experience-story")
  assert.equal(coveredLane.confidence, "high")
  assert.equal(coveredLane.action, "go")

  const weak = retrievePassages("Tell me about a time you rolled out Kubernetes admission controllers.", DOCS)
  const weakLane = routeAnswer({
    question: "Tell me about a time you rolled out Kubernetes admission controllers.",
    questionClass: "experience-story",
    retrieval: weak,
    confirmSurface: true,
  })
  assert.equal(weakLane.confidence, "low")
  assert.equal(weakLane.action, "go", "a lexical miss still generates the not-in-sources answer")
  assert.equal(weakLane.callModel, true)

  const splitQ = "Tell me about a time you handled a leaked API key and your work on Kubernetes admission controllers."
  const split = retrievePassages(splitQ, DOCS)
  const splitLane = routeAnswer({
    question: splitQ,
    questionClass: interviewIntent(splitQ),
    retrieval: split,
    confirmSurface: true,
  })
  assert.equal(splitLane.questionClass, "experience-story")
  assert.equal(splitLane.confidence, "mid")
  assert.equal(splitLane.action, "confirm")
  const noCard = routeAnswer({ question: splitQ, questionClass: "experience-story", retrieval: split, confirmSurface: false })
  assert.equal(noCard.action, "go", "without a confirm surface the partial story still generates")

  const intro = routeAnswer({
    question: "Tell me about yourself.",
    questionClass: "introduction",
    retrieval: retrievePassages("Tell me about yourself.", DOCS),
    confirmSurface: true,
  })
  assert.equal(intro.confidence, "low")
  assert.equal(intro.action, "go")

  const concept = routeAnswer({
    question: "What is vCert?",
    questionClass: "definition",
    retrieval: retrievePassages("What is vCert?", DOCS),
    confirmSurface: true,
  })
  assert.equal(concept.confidence, "low")
  assert.equal(concept.action, "go")
})

test("the route module and the answer service do not take a Jev vendor dependency", () => {
  const route = readFileSync(new URL("../../src/lib/kompasJevRoute.ts", import.meta.url), "utf8")
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const pkg = readFileSync(new URL("../../package.json", import.meta.url), "utf8")
  for (const src of [route, service, pkg]) {
    assert.doesNotMatch(src, /typesafe|jev-1\.|@typesafe|JEV_API|TYPESAFE_API_KEY/)
  }
  assert.match(route, /JEV_ROUTE_TABLE/)
  assert.match(service, /routeAnswer\(/)
  const at = service.indexOf("const sourceRetrieval = retrievePassages(")
  const decided = service.indexOf("if (lane.action !== \"go\") return routeDecisionResponse(", at)
  const paid = service.indexOf("const paidKey = await paidKeyNow()", at)
  const stream = service.indexOf("if (body.stream) return streamAnswer(", at)
  assert.ok(at > 0 && decided > at && decided < paid && paid < stream, "the table runs after retrieval and before the generation call")
  const asked = service.indexOf("let question = latestInterviewerAsk(")
  const guard = service.indexOf("withoutLogistics(", asked)
  const quiet = service.indexOf("const quiet =", asked)
  const keys = service.indexOf("keysFor(", asked)
  const model = service.indexOf("rediscoverRelevance(originalTurnAsk", asked)
  assert.ok(asked > 0 && guard > asked && guard < quiet && quiet < keys && keys < model, "personal logistics still returns before the key read")
})

const req = createRequire(import.meta.url)
const ROOT = new URL("../../", import.meta.url)

function loadAnswerRoute(seen) {
  const stubs = {
    "@/lib/authBoundary": { authenticatedUser: async () => ({ id: "jev-route-user" }) },
    "@/lib/llm": { keysFor: async () => ({ openrouter: "offline-key" }), resolveKeys: () => ({}) },
    "@/lib/rateLimit": { checkRateLimit: () => ({ ok: true }) },
    "@/lib/dossier": { dossierContext: async () => "" },
    "@/lib/sttLedger": { hashUserId: () => "h" },
    "@/lib/llmLedger": { scheduleLlmRecord: () => {} },
  }
  const loaded = new Map()
  const load = (file) => {
    if (loaded.has(file)) return loaded.get(file)
    const mod = { exports: {} }
    loaded.set(file, mod.exports)
    const js = ts.transpileModule(readFileSync(new URL(file, ROOT), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    runInNewContext(js, {
      module: mod, exports: mod.exports, process, console: { ...console, info: () => {}, log: () => {} },
      setTimeout, clearTimeout, AbortController, AbortSignal, Response, TextEncoder, TextDecoder, ReadableStream,
      fetch: async () => { seen.modelCalls++; return Response.json({ choices: [{ message: { content: "I rotated the leaked API key." } }] }) },
      require: (id) => stubs[id] || (id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts")
        : id.startsWith(".") ? load(posix.normalize(posix.join(posix.dirname(file), id.replace(/\.ts$/, "")) + ".ts")) : req(id)),
    }, { filename: file })
    return mod.exports
  }
  const { POST } = load("src/app/api/kompas/answer/route.ts")
  const { NextRequest } = req("next/server")
  return {
    postJson: async (body) => {
      const res = await POST(new NextRequest("http://localhost/api/kompas/answer", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      }))
      return JSON.parse(await res.text())
    },
    postStream: async (body) => {
      const res = await POST(new NextRequest("http://localhost/api/kompas/answer", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, stream: true }),
      }))
      return { type: res.headers.get("content-type"), text: await res.text() }
    },
  }
}

test("the answer route spends a generation call only on go", async () => {
  const seen = { modelCalls: 0 }
  const { postJson, postStream } = loadAnswerRoute(seen)
  const resume = S.resume

  seen.modelCalls = 0
  const logistics = await postJson({ question: "What is your home address?", config: { resume, level: "engineer" } })
  assert.equal(logistics.skipped, "logistics")
  assert.equal(logistics.noQuestion, true)
  assert.equal(seen.modelCalls, 0)

  seen.modelCalls = 0
  const weak = await postJson({
    question: "Tell me about a time you rolled out Kubernetes admission controllers.",
    config: { resume, level: "engineer" },
  })
  assert.equal(weak.text, "I rotated the leaked API key.")
  assert.equal(weak.skipped, undefined)
  assert.ok(seen.modelCalls >= 1, "a lexical miss still reaches the generator")

  seen.modelCalls = 0
  const split = await postJson({
    question: "Tell me about a time you handled a leaked API key and your work on Kubernetes admission controllers.",
    config: { resume, level: "director" },
  })
  assert.equal(split.text, CONFIRM_LINE)
  assert.equal(split.route.action, "confirm")
  assert.equal(split.route.audience, "director")
  assert.equal(split.meta.provider, "code")
  assert.equal(seen.modelCalls, 0)

  seen.modelCalls = 0
  const streamed = await postStream({
    question: "Tell me about a time you handled a leaked API key and your work on Kubernetes admission controllers.",
    config: { resume, level: "engineer" },
  })
  assert.match(streamed.type, /event-stream/)
  assert.match(streamed.text, /I would want to confirm that/)
  assert.doesNotMatch(streamed.text, /noQuestion/)
  assert.equal(seen.modelCalls, 0)

  seen.modelCalls = 0
  const covered = await postJson({
    question: "Tell me about a time you handled a leaked API key.",
    config: { resume, level: "engineer" },
  })
  assert.equal(covered.text, "I rotated the leaked API key.")
  assert.ok(seen.modelCalls >= 1)

  seen.modelCalls = 0
  const intro = await postJson({ question: "Tell me about yourself.", config: { resume, level: "engineer" } })
  assert.equal(intro.text, "I rotated the leaked API key.")
  assert.notEqual(intro.skipped, "evidence")
  assert.ok(seen.modelCalls >= 1)

  seen.modelCalls = 0
  const concept = await postJson({ question: "What is vCert?", config: { resume, level: "engineer" } })
  assert.ok(seen.modelCalls >= 1)
  assert.equal(concept.skipped, undefined)

  seen.modelCalls = 0
  const technical = await postJson({
    question: "How do you troubleshoot TLS certificate errors?",
    config: { resume, level: "engineer" },
  })
  assert.ok(seen.modelCalls >= 1)

  seen.modelCalls = 0
  const hybrid = await postJson({
    question: "Walk me through your hybrid cloud migration.",
    config: { resume, level: "engineer" },
  })
  assert.notEqual(hybrid.skipped, "logistics")
  assert.ok(seen.modelCalls >= 1)
})
