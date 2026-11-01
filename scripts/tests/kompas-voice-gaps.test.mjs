// Voice gaps B1-B3 (30 Oct 2026). Bug-first: each test fails on d8b83174 and passes with the fix.
// B1: an unpunctuated but complete question waited 7 s in Auto instead of 2.2 s.
// B2: a failed or timed-out question-detection model call silently became "no question".
// B3: one stalled transcription held every later phrase back by about 36.5 s.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
function section(start, end) { const a = src.indexOf(start); assert.ok(a >= 0, start); return src.slice(a, src.indexOf(end, a)) }

function autoCtx() {
  const ctx = { AUTO_QUIET_MS: 2200 }
  vm.createContext(ctx)
  vm.runInContext(section("function shortFollowUp(", "function typedFollowUpQuestion(") + "\n" + section("function clauseStillOpen(", "function repeatsPriorQuestionV2(") +
    "\nthis.wait = (t) => (typeof autoWaitMs === 'function' ? autoWaitMs(t) : (clauseStillOpen(t) ? 7000 : AUTO_QUIET_MS));", ctx)
  return ctx
}
const COMPLETE = [
  "What is your experience with Kubernetes",
  "How would you handle a phishing incident",
  "explain your experience with cyberark",
  "Tell me about your Splunk dashboards",
  "Can you walk me through the vault migration",
  "How did you rotate CyberArk passwords at scale",
  "and why",
]
const UNFINISHED = [
  "How would you design a",
  "Tell me about the",
  "Can you tell me",
  "What is your experience with",
  "How do you",
  "Walk me through",
  "Tell me about a time when",
  "So what would you do if",
  "Describe how you would integrate Okta and",
  "Explain the difference between",
]
test("B1: a complete-looking unpunctuated question gets the 2.2 s quiet wait", () => {
  const ctx = autoCtx()
  for (const q of COMPLETE) assert.equal(ctx.wait(q), 2200, q)
})
test("B1: a question that really trails off keeps the long hold", () => {
  const ctx = autoCtx()
  for (const q of UNFINISHED) assert.equal(ctx.wait(q), 7000, q)
})
test("B1: punctuated questions are unchanged", () => {
  const ctx = autoCtx()
  assert.equal(ctx.wait("What is PKI?"), 2200)
  assert.equal(ctx.wait("How would you design a PKI for a bank that already runs Venafi?"), 2200)
})
test("B1: scheduleAuto uses the new wait", () => {
  assert.match(section("function scheduleAuto()", "function noteTurnGate()"), /const wait = autoWaitMs\(tail\)/)
})

// B2
const svc = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
test("B2: the derive endpoint no longer turns a model failure into noQuestion", () => {
  const derive = svc.slice(svc.indexOf("// deriveOnly: the frontend asking"), svc.indexOf("const heardAll"))
  assert.doesNotMatch(derive, /catch\s*\{\s*return NextResponse\.json\(\{ noQuestion: true \}/)
  assert.match(derive, /deriveWithFallback\(/)
})
async function fallback() {
  try { return await import("../../src/lib/kompasDeriveFallback.ts") } catch { return null }
}
test("B2: a failed call is retried once", async () => {
  const m = await fallback(); assert.ok(m, "kompasDeriveFallback.ts missing")
  let n = 0
  const out = await m.deriveWithFallback(async () => { if (++n === 1) throw Error("timeout"); return "What is Kerberos?" }, "Them: what is kerberos")
  assert.equal(n, 2); assert.deepEqual(out, { derived: "What is Kerberos?" })
})
test("B2: two failures fall back to the interviewer's own words, never a silent drop", async () => {
  const m = await fallback(); assert.ok(m, "kompasDeriveFallback.ts missing")
  const timeouts = []
  const out = await m.deriveWithFallback(async (ms) => { timeouts.push(ms); throw Error("The operation was aborted due to timeout") },
    "You: okay\nThem: so we run a big Splunk shop here\nThem: how did you tune noisy SIEM alerts")
  assert.equal(out.derivedBy, "fallback")
  assert.match(out.derived, /tune noisy SIEM alerts/i)
  assert.doesNotMatch(out.derived, /^You:|okay/)
  assert.ok(timeouts.reduce((a, b) => a + b, 0) < 30000, "stays under the page's 30 s derive watchdog")
})
test("B2: an explicit NO_QUESTION and empty speech stay no-question", async () => {
  const m = await fallback(); assert.ok(m, "kompasDeriveFallback.ts missing")
  assert.deepEqual(await m.deriveWithFallback(async () => "NO_QUESTION", "Them: makes sense"), { noQuestion: true })
  assert.deepEqual(await m.deriveWithFallback(async () => { throw Error("x") }, ""), { noQuestion: true })
})

// B3
function transcribeEnv(extra = {}) {
  const state = { entries: [], errors: [], current: { id: "one" }, transcriptionEpoch: 0, transcriptionFailedEpoch: -1, transcriptionOrder: Promise.resolve(), interimOffUntil: 0, running: true, performance, AbortController, setTimeout, clearTimeout, Blob, ...extra }
  state.status = (m) => state.errors.push(m)
  state.onTranscript = (who, text) => state.entries.push({ who, text, at: Date.now() })
  state.showCaption = () => {}
  vm.createContext(state)
  vm.runInContext(section("function whisperPrompt(", "// Owner, 2026-09-30"), state)
  vm.runInContext(section("let speechUploadActive = 0;", "/* ---- what was heard"), state)
  return state
}
test("B3: a stalled phrase no longer holds the next phrase back", { timeout: 15000 }, async () => {
  const pending = []
  const s = transcribeEnv({ fetch: () => new Promise((r) => pending.push(r)) })
  const t0 = Date.now()
  const a = s.transcribe(new Blob(["a"]), "Them", { final: true })
  const b = s.transcribe(new Blob(["b"]), "Them", { final: true })
  await new Promise((r) => setTimeout(r, 20))
  pending[1]({ ok: true, json: async () => ({ text: "Second phrase" }) })
  await b
  const waited = Date.now() - t0
  assert.deepEqual(s.entries.map((e) => e.text), ["Second phrase"])
  assert.ok(waited < 6000, `waited ${waited} ms`)
  pending[0]({ ok: true, json: async () => ({ text: "First phrase" }) })
  await a
  assert.deepEqual(s.entries.map((e) => e.text), ["Second phrase", "First phrase"], "the slow phrase is still shown")
})
test("B3: phrases that arrive on time keep capture order", { timeout: 15000 }, async () => {
  const pending = []
  const s = transcribeEnv({ fetch: () => new Promise((r) => pending.push(r)) })
  const a = s.transcribe(new Blob(["a"]), "Them", { final: true })
  const b = s.transcribe(new Blob(["b"]), "Them", { final: true })
  pending[1]({ ok: true, json: async () => ({ text: "Second" }) })
  await new Promise((r) => setTimeout(r, 50))
  pending[0]({ ok: true, json: async () => ({ text: "First" }) })
  await Promise.all([a, b])
  assert.deepEqual(s.entries.map((e) => e.text), ["First", "Second"])
})
