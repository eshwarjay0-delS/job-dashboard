// System 3: hybrid BM25+dense, rerank 25→5, source grounding, and the three honesty holes.
// A, B, and C were already fixed on master (r11d guards/premises and the logistics return).
// These tests lock that behavior and the new retrieval path. No network, no KOMPAS_VERCEL_API_TOKEN.
import test, { describe } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { posix } from "node:path"
import { runInNewContext } from "node:vm"
import ts from "typescript"
import {
  sourceDocs, splitPassages, retrievePassages, falsePremises, unsupportedClaims, groundSpokenAnswer, clearSourceIndexCache,
  answerPassageCount, hybridRetrievalOn, HYBRID_POOL, HYBRID_ANSWER_K,
} from "../../src/lib/kompasSourceRetrieval.ts"
import { applyGuards, allowedNumbers, questionFigures } from "../../src/lib/kompasGuards.ts"
import { rerankScored } from "../../src/lib/kompasHybridRank.ts"
import { withoutLogistics } from "../../src/lib/kompasRelevance.ts"
import { logisticsBackstop } from "../../src/lib/kompasLogistics.ts"

const RES = "I led cloud security operations at Molina Healthcare, moving alert triage into Splunk and tuning detections with the SOC."
const strip = (q) => logisticsBackstop(withoutLogistics(q))

describe("system 3 retrieval", { concurrency: 1 }, () => {
  test("A: a first-person closed/rotated result does not borrow the question's figure", () => {
    const pairs = [
      ["I heard you closed incidents 70 percent. How?", "I closed 70%."],
      ["I heard you closed incidents 70 percent. How?", "I closed incidents 70 percent at Molina."],
      ["You close incidents 70 percent faster?", "We close incidents 70 percent faster now."],
      ["Closes 70 percent of tickets?", "My team closes 70 percent of tickets in a day."],
      ["Closing 70 percent of tickets?", "I was closing 70 percent of tickets weekly."],
      ["Rotate 70 percent of keys?", "We rotate 70% of keys."],
      ["Rotates 70 percent of keys?", "My team rotates 70 percent of keys monthly."],
      ["Rotating 70 percent of keys?", "I was rotating 70 percent of keys monthly."],
    ]
    for (const [q, a] of pairs) {
      const out = applyGuards(a, null, allowedNumbers(RES), questionFigures(q)).text
      assert.doesNotMatch(out, /70/, `${a} ← ${q} => ${out}`)
    }
  })

  test("A: the question's figure stays only when the sources state that number with the same noun", () => {
    const servers = RES + " Operated 70 servers in the SOC."
    const borrowed = applyGuards("I closed 70% of incidents.", null, allowedNumbers(servers), questionFigures("Your team closed incidents 70 percent, right?")).text
    assert.doesNotMatch(borrowed, /70/)
    const matched = RES + " Closed incidents 70% faster by retiring noisy detections."
    const kept = applyGuards("I closed incidents 70% faster.", null, allowedNumbers(matched), questionFigures("You closed incidents 70% faster?")).text
    assert.match(kept, /70%/)
    const wrongNoun = applyGuards("I closed 70% of tickets.", null, allowedNumbers(matched), questionFigures("You closed 70% of tickets?")).text
    assert.doesNotMatch(wrongNoun, /70/)
  })

  test("B: interviewer-framed resume lead-ins are premises, not covered facts", () => {
    const docs = sourceDocs({ resume: RES })
    const framed = [
      "Your resume says you closed incidents 70 percent. How?",
      "I see on your resume that you reduced incidents by 70%.",
      "It says here you closed incidents 70 percent. Walk me through it.",
    ]
    for (const q of framed) {
      assert.ok(falsePremises(q, docs).some((c) => /70/.test(c)), q)
      const repeated = unsupportedClaims("I closed incidents 70 percent at Molina.", [], docs, q)
      assert.ok(repeated.some((c) => /70/.test(c)), `not covered by the question: ${q} => ${repeated.join(", ")}`)
    }
    const sourced = sourceDocs({ resume: RES + "\nClosed incidents 70% faster at Molina by retiring noisy detections." })
    assert.deepEqual(falsePremises("Your resume says you closed incidents 70% faster. How?", sourced), [])
    assert.deepEqual(unsupportedClaims("I closed incidents 70% faster at Molina.", [], sourced, "Your resume says you closed incidents 70% faster. How?"), [])
  })

  test("C: salary, visa, address, relocation, availability, and notice strip before an answer exists", () => {
    const skipped = [
      "What is your salary?", "Salary?", "Do you need a visa?", "What is your visa status?",
      "What is your home address?", "Are you open to relocation?", "Would you relocate?",
      "What is your availability?", "What is your notice period?", "How much notice do you need?", "When can you start?",
    ]
    for (const q of skipped) assert.equal(strip(q), "", q)
    assert.equal(strip("How did you relocate the Vault servers?"), "How did you relocate the Vault servers?")
    assert.equal(strip("Tell me about the salary data pipeline you built."), "Tell me about the salary data pipeline you built.")
    const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
    const at = service.indexOf("let question = latestInterviewerAsk(")
    const guard = service.indexOf("withoutLogistics(", at)
    const quiet = service.indexOf("const quiet =", at)
    const keys = service.indexOf("keysFor(", at)
    const model = service.indexOf("rediscoverRelevance(originalTurnAsk", at)
    assert.ok(at > 0 && guard > at && guard < quiet && quiet < keys && keys < model, "logistics returns before keysFor and before the model path")
  })

  test("C: the answer service skips logistics without calling the model", async () => {
    const seen = { modelCalls: 0 }
    const { postJson } = loadAnswerRoute(seen)
    const asks = [
      "What is your salary?", "Do you need visa sponsorship?", "What is your home address?",
      "Are you open to relocation?", "What is your availability?", "What is your notice period?",
    ]
    for (const question of asks) {
      seen.modelCalls = 0
      const body = await postJson({ question, config: { resume: RES, level: "engineer" } })
      assert.equal(body.skipped, "logistics", question)
      assert.equal(seen.modelCalls, 0, question)
    }
    seen.modelCalls = 0
    const technical = await postJson({ question: "How did you relocate the Vault servers?", config: { resume: "I relocated the Vault servers at Northwind Bank during the cutover.", level: "engineer" } })
    assert.notEqual(technical.skipped, "logistics")
    assert.ok(seen.modelCalls >= 1, "a work-verb relocation question still reaches the model")
  })

  test("hybrid retrieval surfaces a lexical hit and a paraphrase the BM25 path misses", () => {
    clearSourceIndexCache()
    const paraphrase = "I shortened the open detection queue by retiring noisy Splunk signals at Northwind Bank during overnight operations."
    const lexical = "I documented the shrink unresolved alert backlog procedure in a runbook nobody followed afterwards."
    const fillers = [
      "Wrote Terraform guardrails that block public buckets before a deployment at Northwind.",
      "Mapped HIPAA controls to the audit spreadsheet for the hospital program.",
      "Mentored two analysts on writing clearer runbooks for the weekend handoff.",
      "Built a dashboard of firewall rule changes for the network team.",
      "Reviewed vendor contracts for the logging platform renewal window.",
      "Patched workstation images after the monthly maintenance window.",
      "Documented backup restores for the finance file share.",
      "Configured branch protection on the application repositories.",
    ]
    const docs = sourceDocs({ resume: [lexical, paraphrase, ...fillers].join("\n") })
    const q = "How did you shrink the unresolved alert backlog?"
    const on = retrievePassages(q, docs, 5, { hybrid: true })
    assert.equal(on.passages[0].text, lexical)
    assert.ok(on.passages.some((p) => p.text === paraphrase), "dense match is in the answering set")
    const off = retrievePassages(q, docs, 5, { hybrid: false })
    assert.ok(off.passages.every((p) => p.text !== paraphrase), "BM25-only does not return the paraphrase")
    assert.equal(off.candidates, undefined)
  })

  test("rerank keeps the top 25 and the answer set is the top 5", () => {
    clearSourceIndexCache()
    const gold = "Wrote the leaked api key rotation security review after the maintenance window."
    const stuffed = `${"security ".repeat(40)}review notes`
    const distractors = Array.from({ length: 40 }, (_, i) => `security notes batch ${i} about warehouse shelving and pallet labels number ${i}.`)
    const docs = sourceDocs({ resume: [stuffed, ...distractors, gold].join("\n") })
    const q = "Where is the leaked api key rotation security review?"
    const r = retrievePassages(q, docs, HYBRID_ANSWER_K, { hybrid: true })
    assert.equal(r.candidates, HYBRID_POOL)
    assert.equal(r.passages.length, 5)
    assert.ok(r.passages.some((p) => p.text === gold), r.passages.map((p) => p.text).join(" | "))
    assert.equal(answerPassageCount(), 5)
  })

  test("rerank prefers the contiguous phrase over a passage that only repeats one word", () => {
    const question = "leaked api key rotation security review"
    const stuffed = { text: `${"security ".repeat(12)}review`, base: 1 }
    const gold = { text: "leaked api key rotation security review after the maintenance window", base: 0.35 }
    const filler = Array.from({ length: 23 }, (_, i) => ({ text: `security warehouse notes batch ${i} pallet labels`, base: 0.2 }))
    const pool = [stuffed, ...filler, gold]
    const ranked = rerankScored(question, pool, (row) => row.text, (row) => row.base, () => "experience", () => false)
    assert.equal(ranked.length, 25)
    assert.equal(ranked[0].row, gold)
  })

  test("KOMPAS_HYBRID_RETRIEVAL=0 turns hybrid rerank off", () => {
    const prev = process.env.KOMPAS_HYBRID_RETRIEVAL
    process.env.KOMPAS_HYBRID_RETRIEVAL = "0"
    try {
      assert.equal(hybridRetrievalOn(), false)
      assert.equal(answerPassageCount(), 4)
    } finally {
      if (prev === undefined) delete process.env.KOMPAS_HYBRID_RETRIEVAL
      else process.env.KOMPAS_HYBRID_RETRIEVAL = prev
    }
    assert.equal(hybridRetrievalOn(), true)
  })

  test("grounding keeps raw text and does not speak invented detail", () => {
    const docs = sourceDocs({ resume: "At Northwind Bank I built Splunk detections and cut triage time by 40%." })
    const passages = splitPassages(docs)
    const before = passages.map((p) => p.text).join("\n")
    const hypothesis = "Hypothesis: the token was stale."
    const invented = "Hypothesis: the token was stale because the IdP cache expired after 70 percent of sessions."
    const grounded = groundSpokenAnswer(invented, passages, docs, "What was your hypothesis?", hypothesis)
    assert.equal(grounded.raw, hypothesis)
    assert.equal(passages.map((p) => p.text).join("\n"), before)
    assert.doesNotMatch(grounded.presentation, /IdP cache expired/)
    assert.doesNotMatch(grounded.presentation, /70/)
    assert.match(grounded.presentation, /not in the sources/i)
    assert.notEqual(grounded.presentation, grounded.raw)

    const supported = groundSpokenAnswer("At Northwind Bank I built Splunk detections and cut triage time by 40%.", passages, docs, "How did you speed up triage?")
    assert.match(supported.presentation, /Northwind Bank/)
    assert.match(supported.presentation, /40%/)
    assert.doesNotMatch(supported.presentation, /not in the sources/)

    const mixed = groundSpokenAnswer("At Northwind Bank I built Splunk detections. At Globex I cut triage time by 75%.", passages, docs, "How did you speed up triage?")
    assert.match(mixed.presentation, /Northwind Bank/)
    assert.doesNotMatch(mixed.presentation, /Globex/)
    assert.doesNotMatch(mixed.presentation, /75/)
    assert.match(mixed.presentation, /That part is not in the sources/)
  })

  test("grounding keeps a system relocation and drops an unstated address", () => {
    const docs = sourceDocs({ resume: "I relocated the Vault servers during the data center move at Northwind Bank." })
    const passages = splitPassages(docs)
    const moved = groundSpokenAnswer("I relocated the Vault servers.", passages, docs, "How did you move the platform?")
    assert.match(moved.presentation, /relocated the Vault servers/)
    const address = groundSpokenAnswer("I live in Austin.", passages, docs, "How did you move the platform?")
    assert.doesNotMatch(address.presentation, /Austin/)
    const stated = sourceDocs({ resume: "Based in Austin while supporting the Northwind healthcare program for two years." })
    const asked = groundSpokenAnswer("I live in Austin.", splitPassages(stated), stated, "Where are you based?")
    assert.match(asked.presentation, /Austin/)
  })

  test("new system 3 files do not require a Vercel token or FluidVoice", () => {
    for (const file of ["src/lib/kompasHybridRank.ts", "src/lib/kompasSourceRetrieval.ts", "src/lib/kompasAnswerService.ts"]) {
      const text = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8")
      assert.doesNotMatch(text, /KOMPAS_VERCEL_API_TOKEN/)
      assert.doesNotMatch(text, /FluidVoice/)
    }
  })
})

const req = createRequire(import.meta.url)
const ROOT = new URL("../../", import.meta.url)

function loadAnswerRoute(seen) {
  const stubs = {
    "@/lib/authBoundary": { authenticatedUser: async () => ({ id: "system3-user" }) },
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
      fetch: async () => { seen.modelCalls++; return Response.json({ choices: [{ message: { content: "I relocated the Vault servers." } }] }) },
      require: (id) => stubs[id] || (id.startsWith("@/") ? load("src/" + id.slice(2) + ".ts")
        : id.startsWith(".") ? load(posix.normalize(posix.join(posix.dirname(file), id.replace(/\.ts$/, "")) + ".ts")) : req(id)),
    }, { filename: file })
    return mod.exports
  }
  const { POST } = load("src/app/api/kompas/answer/route.ts")
  const { NextRequest } = req("next/server")
  return { postJson: async (body) => {
    const res = await POST(new NextRequest("http://localhost/api/kompas/answer", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }))
    return JSON.parse(await res.text())
  } }
}
