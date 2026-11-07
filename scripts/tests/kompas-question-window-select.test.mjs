// Question windows (6 Nov 2026). The assembled interviewer ask tries Last 1 2 3 4,
// then Last 1 2 3, then Last 1 2, then Last 1. A trailing fragment keeps the
// setup it depends on. Unrelated successive questions are not one mega-question.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { questionKernel } from "../../src/lib/kompasIntentKernel.ts"
import {
  assembleQuestionWindow,
  mergeQuestionSpans,
  questionPieces,
  selectQuestionWindow,
} from "../../src/lib/kompasQuestionWindow.ts"
import { splitDistinctAsks } from "../../src/lib/kompasAnswer.ts"

const has = (text, part) => assert.ok(String(text).toLowerCase().includes(part.toLowerCase()), `"${part}" missing from: ${text}`)
const lacks = (text, part) => assert.ok(!String(text).toLowerCase().includes(part.toLowerCase()), `"${part}" should not be in: ${text}`)

test("1. a trailing fragment keeps the previous sentence (Last 1 2)", () => {
  const heard = "Walk me through how you designed the incident pipeline and how you measured MTTR. And what would you change?"
  const pick = assembleQuestionWindow(heard)
  assert.equal(pick.label, "Last 1 2")
  assert.equal(pick.span, 2)
  has(pick.text, "Walk me through how you designed the incident pipeline")
  has(pick.text, "how you measured MTTR")
  has(pick.text, "what would you change")
  const ask = questionKernel(heard).ask
  has(ask, "incident pipeline")
  has(ask, "measured MTTR")
  has(ask, "what would you change")
  assert.notEqual(ask.trim().toLowerCase(), "and what would you change?")
})

test("2. three related pieces keep the earlier setup, not only the last clause", () => {
  const heard = "Tell me about a time you led a migration. Specifically the rollback plan. And how you communicated it."
  const pick = assembleQuestionWindow(heard)
  assert.equal(pick.label, "Last 1 2 3")
  assert.equal(pick.span, 3)
  has(pick.text, "led a migration")
  has(pick.text, "rollback plan")
  has(pick.text, "how you communicated it")
  const ask = questionKernel(heard).ask
  has(ask, "led a migration")
  has(ask, "rollback plan")
  has(ask, "communicated it")
})

test("2b. four related pieces stay one window (Last 1 2 3 4)", () => {
  const pieces = [
    "Tell me about a time you led a migration.",
    "Specifically the rollback plan.",
    "And how you communicated it.",
    "And what you would do differently next time?",
  ]
  const pick = selectQuestionWindow(pieces)
  assert.equal(pick.label, "Last 1 2 3 4")
  assert.equal(pick.span, 4)
  for (const part of ["led a migration", "rollback plan", "communicated it", "differently next time"]) has(pick.text, part)
})

test("3. four unrelated successive questions stay Last 1", () => {
  const pieces = ["What is Kubernetes?", "What is Terraform?", "What is Ansible?", "Where do you live?"]
  const pick = selectQuestionWindow(pieces)
  assert.equal(pick.label, "Last 1")
  assert.equal(pick.span, 1)
  assert.equal(pick.text, "Where do you live?")
  lacks(pick.text, "Kubernetes")
  lacks(pick.text, "Terraform")
  lacks(pick.text, "Ansible")
  const heard = pieces.join(" ")
  const ask = questionKernel(heard).ask
  assert.equal(ask, "Where do you live?")
  assert.deepEqual(mergeQuestionSpans(pieces), pieces)
})

test("4. a complete standalone last question does not pull in the earlier ask", () => {
  const pieces = ["How do you scope an access review?", "What is least privilege?"]
  const pick = selectQuestionWindow(pieces)
  assert.equal(pick.label, "Last 1")
  assert.equal(pick.span, 1)
  assert.equal(pick.text, "What is least privilege?")
  lacks(pick.text, "access review")
  const ask = questionKernel(pieces.join(" ")).ask
  assert.equal(ask, "What is least privilege?")
})

test("a coordinated and-how inside one sentence is not cut down to the tail", () => {
  const heard = "Walk me through how you designed the incident pipeline and how you measured MTTR."
  assert.equal(questionPieces(heard).length, 1)
  has(questionKernel(heard).ask, "incident pipeline")
  has(questionKernel(heard).ask, "measured MTTR")
})

test("company preface is not a question piece", () => {
  const heard = "We have 27 cybersecurity control areas. What questions do you have for me?"
  assert.deepEqual(questionPieces(heard), ["What questions do you have for me?"])
  assert.equal(questionKernel(heard).ask, "What questions do you have for me?")
})

test("a parallel two-part investigation stays together", () => {
  const heard = "How did you identify the root cause? How did you validate the proposed fix?"
  const pick = assembleQuestionWindow(heard)
  assert.equal(pick.span, 2)
  has(pick.text, "root cause")
  has(pick.text, "proposed fix")
  has(questionKernel(heard).ask, "root cause")
  has(questionKernel(heard).ask, "proposed fix")
})

test("the microphone cut rejoins a dependent fragment and leaves unrelated asks split", () => {
  const fragment = splitDistinctAsks("Walk me through how you designed the incident pipeline and how you measured MTTR. And what would you change?")
  assert.ok(fragment.length >= 2, fragment.join(" | "))
  const merged = mergeQuestionSpans(fragment)
  assert.equal(merged.length, 1)
  has(merged[0], "incident pipeline")
  has(merged[0], "what would you change")
  const separate = splitDistinctAsks("What is Kubernetes? What is Terraform?")
  assert.equal(mergeQuestionSpans(separate).length, 2)
})

test("the desktop page uses the same window selection as the server", () => {
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const start = app.indexOf("const QW_LABELS")
  const end = app.indexOf("// ── Question intake", start)
  assert.ok(start > 0 && end > start)
  const ctx = {}
  vm.createContext(ctx)
  vm.runInContext(app.slice(start, end) + "\nthis.questionPieces=questionPieces; this.selectQuestionWindow=selectQuestionWindow; this.assembleQuestionWindow=assembleQuestionWindow; this.mergeQuestionSpans=mergeQuestionSpans;", ctx)
  const samples = [
    "Walk me through how you designed the incident pipeline and how you measured MTTR. And what would you change?",
    "Tell me about a time you led a migration. Specifically the rollback plan. And how you communicated it.",
    "What is Kubernetes? What is Terraform? What is Ansible? Where do you live?",
    "How do you scope an access review? What is least privilege?",
    "How did you identify the root cause? How did you validate the proposed fix?",
    "We have 27 cybersecurity control areas. What questions do you have for me?",
  ]
  for (const heard of samples) {
    const server = assembleQuestionWindow(heard)
    const desk = ctx.assembleQuestionWindow(heard)
    assert.equal(desk.label, server.label, heard)
    assert.equal(desk.span, server.span, heard)
    assert.equal(desk.text, server.text, heard)
    assert.equal(JSON.stringify(Array.from(ctx.questionPieces(heard))), JSON.stringify(questionPieces(heard)), heard)
  }
  const spans = ["What is Kubernetes?", "What is Terraform?", "What is Ansible?", "Where do you live?"]
  assert.equal(JSON.stringify(Array.from(ctx.mergeQuestionSpans(spans))), JSON.stringify(mergeQuestionSpans(spans)))
  assert.deepEqual(ctx.selectQuestionWindow(spans).label, "Last 1")
  const related = [
    "Tell me about a time you led a migration.",
    "Specifically the rollback plan.",
    "And how you communicated it.",
    "And what you would do differently next time?",
  ]
  assert.equal(ctx.selectQuestionWindow(related).label, "Last 1 2 3 4")
})
