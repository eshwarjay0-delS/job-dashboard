// One fixed rule engine for browser and API: validate original perfACT
// code as shipped in MarketFit rather than reimplementing it in the test.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createContext, runInContext } from "node:vm"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (p) => readFileSync(path.join(ROOT, p), "utf8")
const vm = createContext({})
for (const name of ["pace-core.js", "score-core.js", "review-core.js", "lexicon-data.js", "lexicon-core.js"]) {
  runInContext(read("public/kompas/" + name), vm, { filename: name, timeout: 5000 })
}
const { KompasPace: pace, KompasScore: score, KompasReviewCore: review, KompasLexicon: lexicon } = vm

test("pace calculations preserve spoken content and measure pauses without a model call", () => {
  const answer = "I first checked the Azure application logs. Then I compared the failures with the WAF policy. We fixed the rule and retested the API."
  const report = pace.report(answer)
  assert.ok(report.words > 18)
  assert.ok(report.seconds > 0)
  assert.ok(Array.isArray(report.notes))
  const units = pace.pace(answer)
  assert.ok(Array.isArray(units) && units.length > 0)
  const spoken = pace.opened(answer, 0)
  assert.ok(spoken.includes(answer), "Adding an opener cannot delete the speaker's facts")
})

test("score engine measures grounded technical interview answers exactly as in perfACT", () => {
  const answer = "I started with Sentinel alerts, then checked the affected host logs because the timeline mattered. I confirmed the event with the IAM sign-in records. After validating the scope, I updated the detection rule and retested it with the security team."
  const verdict = score.score(answer, { question: "How did you investigate an alert?", resume: "", about: "how" })
  assert.equal(typeof verdict.enough, "boolean")
  assert.ok(Array.isArray(verdict.rules))
  assert.ok(Array.isArray(verdict.fixes) || verdict.enough === false)
  assert.ok(score.book().length > 0)
})

test("review and practice remain code-only and return useful diagnostics", () => {
  const answer = "I used Burp Suite to test the authorization controls. I confirmed the object ID was exposed and then checked whether another user could access the resource. I explained the impact and suggested an object-level authorization check."
  const practice = review.practice(answer, "Technical", 38, "How did you validate an IDOR?")
  assert.ok(practice && typeof practice === "object")
  const transcript = "Them: How did you validate the issue?\nMe: " + answer
  const sessions = review.review(transcript, { me: "Me", name: "Test", detail: "summary", limit: 10, title: "Regression" })
  assert.ok(Array.isArray(sessions), "Original parser returns a collection of reviewed sessions")
})

test("enterprise vocabulary is fully available, with conservative correction", () => {
  const functions = lexicon.functions()
  assert.ok(Array.isArray(functions) && functions.length >= 20)
  assert.ok(functions.some(f => f.terms > 0))
  const out = lexicon.canonicalize("We checked DHCP and Sentinel.", [])
  assert.equal(typeof out.text, "string")
  assert.ok(Array.isArray(out.changes))
  assert.ok(Array.isArray(out.maybe))
  assert.ok(out.text.toLowerCase().includes("sentinel"))
})

test("frontend, server and source snapshots use one set of native endpoints", () => {
  const shim = read("src/lib/kompas-shell.ts")
  const route = read("src/app/api/kompas/[feature]/route.ts")
  const runtime = read("src/lib/kompasReviewRuntime.ts")
  for (const feature of ["pace", "score", "review", "practice", "lexicon"]) {
    assert.ok(shim.includes("'/api/" + feature + "': '/api/kompas/" + feature + "'"), feature + " fetch bypasses native engine")
    assert.ok(route.includes('"' + feature + '"'), feature + " route missing")
  }
  for (const module of ["pace-core.js", "score-core.js", "review-core.js", "lexicon-core.js", "lexicon-data.js"]) {
    assert.ok(runtime.includes(module), "Original source not included in server engine: " + module)
  }
})
