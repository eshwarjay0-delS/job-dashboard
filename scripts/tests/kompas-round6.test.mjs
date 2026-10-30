// Round 6 (29 Oct 2026): the four open reds from the offline stress log, each with a failing test and a failsafe.
// Offline and code-level only. Not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  dissectQuestion, draftSpokenAnswer, settleSpokenAnswer, sameAnswerRatio, wordCount, relativeGap,
  firstPersonRewrite, candidateName, answerEchoesPrevious,
} from "../../src/lib/kompasDissection.ts"
import { repairDictation } from "../../src/lib/kompasDictation.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const LEVELS = ["engineer", "director", "architect"]

// ---- 1. Misheard "residual risk"
test("a misheard 'resid jewel risk' is repaired and read as a definition", () => {
  assert.equal(repairDictation("what's the resid jewel risk"), "what's the residual risk")
  const cut = dissectQuestion("um so like what's the uh resid jewel risk thing")
  assert.equal(cut.shape, "definition")
  assert.ok(cut.keywords.includes("residual risk"), cut.keywords.join("|"))
  for (const heard of ["what's residue all risk", "what is residual jewel risk", "explain the residue jewel risk"]) assert.match(repairDictation(heard), /residual risk/)
})
test("failsafe: other jewel phrases and real words are left alone", () => {
  for (const s of ["We protect the crown jewel risk register first.", "The residue on the sensor was cleaned.", "Residual risk stays on the register."]) assert.equal(repairDictation(s), s)
})
test("short 'what's X' is a definition, 'what's your X' is not", () => {
  for (const q of ["what's residual risk", "what's the residual risk?", "What's a compensating control?", "what's zero trust"]) assert.equal(dissectQuestion(q).shape, "definition", q)
  for (const q of ["What's your biggest weakness?", "what's your salary expectation?"]) assert.notEqual(dissectQuestion(q).shape, "definition", q)
})

// ---- 2. Third-person live output
test("the candidate's name is read from the resume header", () => {
  assert.deepEqual(candidateName(RESUME), { first: "Jordan", full: "Jordan Hale" })
  assert.equal(candidateName("## Experience\nTracked risk on open findings for the business owner."), null)
})
test("third person about the candidate is rewritten to first person when it is safe", () => {
  const r = firstPersonRewrite("Jordan tracked residual risk on open findings. He told the business what remained.", RESUME)
  assert.equal(r.text, "I tracked residual risk on open findings. I told the business what remained.")
  assert.equal(r.thirdPerson, false)
  const s = settleSpokenAnswer("What does residual risk mean?", "Jordan Hale tracked residual risk on open findings. Jordan's summary told the business what remained.", "architect", RESUME)
  assert.doesNotMatch(s.text, /Jordan/)
  assert.match(s.text, /^I tracked residual risk/)
  assert.match(s.text, /My summary told/)
})
test("third person that has no safe rewrite is flagged, not guessed", () => {
  const r = firstPersonRewrite("Jordan tracks residual risk on open findings every week.", RESUME)
  assert.equal(r.text, "Jordan tracks residual risk on open findings every week.")
  assert.equal(r.thirdPerson, true)
  const mid = firstPersonRewrite("Residual risk was tracked by Jordan on open findings.", RESUME)
  assert.equal(mid.thirdPerson, true)
  const s = settleSpokenAnswer("What does residual risk mean?", "Jordan tracks residual risk on open findings every week.", "engineer", RESUME)
  assert.equal(s.thirdPerson, true)
  assert.equal(s.inBand, false)
  assert.ok(s.text, "the answer is kept, never blanked")
})
test("failsafe: other people in a first-person story are not rewritten or flagged", () => {
  for (const t of ["My manager Sam reviewed the plan. He agreed to hold the item.", "I sent it back. She signed off a week later.", "I tracked residual risk on open findings."]) {
    const r = firstPersonRewrite(t, RESUME)
    assert.equal(r.text, t)
    assert.equal(r.thirdPerson, false, t)
  }
  assert.equal(firstPersonRewrite("I'm Jordan Hale, and I review remediation plans.", RESUME).thirdPerson, false)
  // No name in the sources: nothing is rewritten.
  assert.equal(firstPersonRewrite("Jordan tracked risk.", "").text, "Jordan tracked risk.")
})
test("the repair loop is told about third person it cannot fix itself", () => {
  const s = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(s, /repairLoopVoiceEchoChecks\(job\.question, text, job\.previousTurns, job\.sourceText\)/)
})

// ---- 3. Mode gap on a trick question
test("trick question: each mode is at least 50% longer than the one below (stand-in)", () => {
  for (const q of ["Would you bypass a control if the CEO asked you to?", "Would you ever ignore a finding to hit a deadline?", "Is one hundred percent security possible?"]) {
    const w = LEVELS.map((l) => wordCount(draftSpokenAnswer(q, l, RESUME)))
    assert.ok(relativeGap(w[0], w[1]) >= 0.5, `${q} engineer ${w[0]} director ${w[1]}`)
    assert.ok(relativeGap(w[1], w[2]) >= 0.5, `${q} director ${w[1]} architect ${w[2]}`)
  }
})
test("failsafe: no mode is pushed past its own ceiling to make the gap", () => {
  for (const q of ["Would you bypass a control if the CEO asked you to?", "What is residual risk?", "How do you secure Kubernetes clusters?"]) {
    const cut = dissectQuestion(q, RESUME)
    for (const l of LEVELS) assert.ok(wordCount(draftSpokenAnswer(q, l, RESUME)) <= cut.modes[l].maxWords, `${q} ${l}`)
  }
})

// ---- 4. Near-duplicate questions
const PAIRS = [
  ["What is a policy exception?", "When would you reject a policy exception?"],
  ["How do you track open findings?", "How do you close open findings?"],
  ["How do you secure Kubernetes clusters?", "How do you secure a CI pipeline?"],
  ["What is zero trust?", "What is SASE?"],
  ["When would you accept residual risk?", "When would you not accept residual risk?"],
  ["How do you keep user accounts safe?", "How do you keep service accounts safe?"],
]
test("production check: the previous answer given again to a different question is caught", () => {
  for (const [a, b] of PAIRS) {
    const prev = draftSpokenAnswer(a, "director", RESUME)
    const echo = answerEchoesPrevious(b, prev, [{ q: a, a: prev }])
    assert.equal(echo.same, true, `${a} -> ${b}`)
    assert.ok(echo.reason, "a reason the repair can act on")
  }
})
test("production check: an answer that keeps the shared topic but answers the new words is not flagged", () => {
  const prev = "A policy exception is an approved, time-limited departure from a policy, with a compensating control and an owner."
  const next = "I reject a policy exception when it has no end date, no owner, or no compensating control, and I send it back with what is missing."
  assert.equal(answerEchoesPrevious("When would you reject a policy exception?", next, [{ q: "What is a policy exception?", a: prev }]).same, false)
})
test("failsafe: follow-ups, asked repeats and the same question are never flagged", () => {
  const prev = draftSpokenAnswer("What is residual risk?", "engineer", RESUME)
  for (const q of ["Can you repeat that?", "Say that again.", "What is residual risk?", "Go deeper — following up on: \"What is residual risk\"?"]) {
    assert.equal(answerEchoesPrevious(q, prev, [{ q: "What is residual risk?", a: prev }]).same, false, q)
  }
  assert.equal(answerEchoesPrevious("What is SASE?", "", [{ q: "What is zero trust?", a: prev }]).same, false)
  assert.equal(answerEchoesPrevious("What is SASE?", prev, []).same, false)
})
test("stand-in, as asked live (after the first question): different questions get different answers", () => {
  for (const [a, b] of PAIRS) for (const l of LEVELS) {
    const first = draftSpokenAnswer(a, l, RESUME)
    const next = draftSpokenAnswer(b, l, RESUME, [first])
    const r = sameAnswerRatio(first, next)
    assert.ok(r < 0.7, `${l}: ${a} -> ${b} Jaccard ${r.toFixed(2)}\n${first}\n${next}`)
    assert.equal(answerEchoesPrevious(b, next, [{ q: a, a: first }]).same, false, `${l}: ${b} flagged\n${next}`)
  }
})
test("settle drops sentences said in any of the last three answers, not only the last one", () => {
  const older = "I compared the evidence in the ticket with the live setting before signing off on a fix."
  const last = "I wrote the weekly risk summary for the business owner in plain language."
  const raw = "I close a finding only when the live setting matches the fix and the owner confirms it. I compared the evidence in the ticket with the live setting before signing off on a fix."
  const s = settleSpokenAnswer("How do you close a finding?", raw, "director", RESUME, [older, last].join("\n"))
  assert.doesNotMatch(s.text, /compared the evidence/)
  const svc = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(svc, /repairLoopVoiceEchoChecks\(job\.question, text, job\.previousTurns, job\.sourceText\)/)
  assert.match(readFileSync(new URL("../../src/lib/kompasDissection.ts", import.meta.url), "utf8"), /answerEchoesPrevious\(question, text, previousTurns\)/)
})

// ---- Round 6 stress reds, fixed with a failing test and a failsafe each
import { isProviderErrorAnswer } from "../../src/lib/kompasDissection.ts"
import { smallTalkOnly } from "../../src/lib/kompasAnswer.ts"

test("misheard jargon is grounded on the repaired ask, not the raw one", () => {
  const cut = dissectQuestion("what's the cooper netties control plane")
  assert.ok(!cut.banned.some((b) => /cooper|netties/i.test(b)), cut.banned.join("|"))
  // The asked tool, once repaired, is grounded: Kubernetes and Terraform must not be banned (before the fix they were).
  assert.ok(!cut.banned.includes("Kubernetes"), cut.banned.join("|"))
  assert.ok(!dissectQuestion("how would you use terror form for this").banned.includes("Terraform"))
  assert.equal(repairDictation("what's the cooper netties control plane"), "what's the Kubernetes control plane")
})
test("interviewer asides are small talk; failsafe: an aside followed by a real ask is not", () => {
  for (const t of ["so yeah, that's basically the team", "right, right", "we'll circle back on that", "my screen froze for a second", "I'm writing that down"]) assert.ok(smallTalkOnly(t), t)
  for (const t of ["we'll circle back on that. How do you scope an access review?", "my screen froze, what is least privilege?", "right, right. So how would you track exceptions"]) assert.ok(!smallTalkOnly(t), t)
})
test("status-line provider errors are refused; failsafe: answers that mention HTTP codes or timeouts are kept", () => {
  for (const t of ["HTTP 503 Service Unavailable", "HTTP/1.1 429 Too Many Requests", "The upstream request timed out.", "The server call timed out after waiting."]) assert.ok(isProviderErrorAnswer(t), t)
  for (const t of ["HTTP 503 errors from the scanner go to the owner as a ticket.", "I would add a timeout so a slow upstream request does not block the review queue."]) assert.ok(!isProviderErrorAnswer(t), t)
})
test("a short new answer that says the new words is not an echo; failsafe: a copied body with a new opener is", () => {
  const prev = "Here is what compensating control means in my own work. I have not done this in a past role, so I will walk through how I would handle it."
  const fresh = "On when a compensating control is not enough: when it does not cut the same risk, I escalate to the owner."
  assert.equal(answerEchoesPrevious("When is a compensating control not enough?", fresh, [{ q: "What is a compensating control?", a: prev }]).same, false)
  const body = "I accept residual risk when the owner signs it off, a compensating control is in place, and the acceptance has an expiry date. I record the reason in the register and review it before it expires."
  assert.equal(answerEchoesPrevious("Who signs off residual risk?", "The owner signs off residual risk. " + body, [{ q: "When would you accept residual risk?", a: body }]).same, true)
})
test("third person with an adverb is rewritten; failsafe: a leftover he/she with no safe verb is flagged", () => {
  const sources = RESUME
  const name = candidateName(sources)
  assert.ok(name, "the sample resume names the candidate")
  const ok = firstPersonRewrite(`${name.first} led the access review. He then checked the fix a month later.`, sources)
  assert.match(ok.text, /^I led .*I then checked/); assert.equal(ok.thirdPerson, false)
  const left = firstPersonRewrite(`${name.first} led the access review. He thinks it went well.`, sources)
  assert.equal(left.thirdPerson, true)
})
