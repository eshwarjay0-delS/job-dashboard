import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { sourceDocs, splitPassages, retrievePassages, sourcePassagesPrompt, NOT_IN_SOURCES, clearSourceIndexCache } from "../../src/lib/kompasSourceRetrieval.ts"

// Documents first (Nov 1): attached material (question banks, guides) is its
// own source, leads the presented passages, and takes the top-k slots before
// dossier notes. Dossier is the user's notes; documents are the precise
// supporting material. The engine still ranks by relevance inside each tier,
// and selection stays relevance-gated (only scoring passages are ranked).
const service = readFileSync("src/lib/kompasAnswerService.ts", "utf8")

test("sourceDocs keeps documents separate from dossier notes", () => {
  const docs = sourceDocs({ documents: "guide line about triage", dossier: "personal note about triage" })
  const names = docs.map((d) => d.name)
  assert.ok(names.includes("documents"), "documents entry exists")
  assert.ok(names.includes("dossier"), "dossier entry exists")
  assert.equal(docs.find((d) => d.name === "dossier").text, "personal note about triage")
  assert.ok(!docs.find((d) => d.name === "dossier").text.includes("guide line"))
  assert.equal(docs.find((d) => d.name === "documents").text, "guide line about triage")
})

test("document passages carry their own label, not the dossier label", () => {
  const passages = splitPassages(sourceDocs({
    documents: "SOC triage runbook step one two three four",
    dossier: "personal triage note one two three four",
  }))
  assert.ok(passages.find((p) => p.source === "documents").id.startsWith("M"), "documents prefix M")
  assert.ok(passages.find((p) => p.source === "dossier").id.startsWith("D"), "dossier prefix D")
})

test("a matching document passage leads even when a dossier note scores higher", () => {
  clearSourceIndexCache()
  const docs = sourceDocs({
    documents: "SOC triage guide: contain the alert, preserve evidence, escalate severity.",
    dossier: "triage soc alert triage soc alert triage soc alert",
  })
  const r = retrievePassages("how do you triage a soc alert", docs, 4)
  assert.ok(r.passages.length >= 2, "both passages retrieved")
  assert.equal(r.passages[0].source, "documents", "document leads")
  const bySource = Object.fromEntries(r.all.map((p) => [p.source, p.score]))
  assert.ok(bySource.dossier > bySource.documents, "dossier genuinely scored higher, order beat score")
  assert.match(sourcePassagesPrompt(r), /documents/, "prompt block labels the document passage")
})

test("document passages take top-k slots before dossier notes", () => {
  clearSourceIndexCache()
  const docs = sourceDocs({
    documents: "SOC triage guide: contain the alert, preserve evidence, escalate severity.",
    dossier: [
      "triage soc alert triage soc alert",
      "soc alert triage soc alert triage",
      "alert triage soc alert triage soc",
      "triage alert soc triage alert soc",
    ].join("\n"),
  })
  const r = retrievePassages("how do you triage a soc alert", docs, 4)
  assert.equal(r.passages.length, 4, "top-k still four")
  assert.equal(r.passages[0].source, "documents", "document takes the first slot")
  assert.equal(r.passages.filter((p) => p.source === "dossier").length, 3, "lowest dossier note displaced")
})

test("without documents the relevance order is unchanged", () => {
  clearSourceIndexCache()
  const docs = sourceDocs({
    resume: "handled oncall incidents for cloud platform",
    dossier: "oncall incident story rotation",
  })
  const r = retrievePassages("how did you handle oncall incidents", docs, 4)
  const scores = r.passages.map((p) => p.score)
  assert.ok(scores.every((s, i) => i === 0 || scores[i - 1] >= s), "score order preserved")
})

test("prompt rules state documents-first and the material-versus-history line", () => {
  assert.ok(service.includes("DOCUMENTS FIRST"), "answer service carries the rule")
  assert.ok(service.includes("dossier notes only as support"), "dossier demoted to support")
  assert.ok(service.includes("claim personal experience only from the resume or dossier"), "material never proves experience")
  assert.ok(NOT_IN_SOURCES.includes("documents, dossier"), "unmatched text names documents")
})
