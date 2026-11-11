// Fix 2: follow-up interrogation simulator (prompt/parse/verdict; the model call is injected, no network here).
import test from "node:test"
import assert from "node:assert/strict"
const { interrogate, parseInterrogation, interrogationUser, interrogationRetry, INTERROGATION_SYSTEM } = await import("../../src/lib/kompasInterrogate.ts")

const ok = JSON.stringify({ followups: [{ q: "Who approved it?", reply: "The CISO signed the exception.", holds: true }, { q: "How did you verify?", reply: "A rescan showed the patched version.", holds: true }, { q: "What failed?", reply: "The first window was too short.", holds: true }], contradictions: [], technical: [], authority: "ok", attribution: "ok", scale: "ok", parts: [{ part: "who has the authority", covered: true }], survives: true, fix: "" })
test("a consistent answer survives", async () => {
  const r = await interrogate(async () => "here you go " + ok, { question: "q", answer: "a", roles: "Citi Bank: engineer" })
  assert.equal(r.pass, true); assert.equal(r.held, 3); assert.equal(r.issues.length, 0)
})
test("a collapsed follow-up, a contradiction or a missed part fails, and becomes a retry issue", () => {
  const bad = JSON.parse(ok); bad.followups[1].holds = false; bad.followups[1].problem = "PowerShell logs on a Linux host"; bad.contradictions = ["says suspended, record says temporary access"]; bad.parts[0].covered = false
  const r = parseInterrogation(JSON.stringify(bad))
  assert.equal(r.survives, false); assert.equal(r.pass, false)
  const codes = r.issues.map((i) => i.code)
  for (const c of ["contradiction", "followup-collapse", "part-missed"]) assert.ok(codes.includes(c), c)
  assert.match(interrogationRetry("q", "draft", r.issues), /PowerShell logs on a Linux host/)
})
test("'none' placeholders are not counted as problems; wrong authority is", () => {
  const r = parseInterrogation(JSON.stringify({ ...JSON.parse(ok), contradictions: ["none"], technical: ["None"], authority: "wrong: an engineer can't sign a risk exception" }))
  assert.equal(r.contradictions.length, 0); assert.equal(r.survives, false)
})
test("model errors never pass", async () => {
  const r = await interrogate(async () => { throw new Error("timeout") }, { question: "q", answer: "a", roles: "" })
  assert.equal(r.pass, false); assert.match(r.error, /timeout/)
  const u = await interrogate(async () => "no json", { question: "q", answer: "a", roles: "" })
  assert.equal(u.pass, false)
})
test("the prompt judges defensibility, not truth, and carries ledger, checklist and story record", () => {
  assert.match(INTERROGATION_SYSTEM, /do NOT ask whether it really happened/)
  const u = interrogationUser({ question: "Q?", answer: "A.", roles: "R", ledger: "- incident: system X", checklist: ["who has the authority"], node: { employer: "Citi Bank", system: "trading API" } })
  assert.match(u, /system X/); assert.match(u, /who has the authority/); assert.match(u, /trading API/)
})
