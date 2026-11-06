// Code-level checks for the 29 Oct 2026 relevance folds. These prove the code paths, not live answer quality:
// live quality is only measured by scripts/kompas-live-eval.mjs with a real token.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  askedPartList, asksForCode, dissectQuestion, dissectionPrompt,   draftSpokenAnswer, dropParaphrasedRepeat, evaluateLiveAnswers, standInFence,
  experienceLines, isProviderErrorAnswer, leadPhrase, partsScale, questionKeywords, requiredSentence, sameAnswerRatio, sentencesOf, settleSpokenAnswer,
  topicOfAsk, trimToWords, wordCount,
} from "../../src/lib/kompasDissection.ts"
import { applyGuards, questionFigures } from "../../src/lib/kompasGuards.ts"
import { STRUCTURE_REPAIR_SYSTEM, structureRepairSystem } from "../../src/lib/kompasAnswer.ts"
import { judgeRewrite, lostAfterSettle, statusFor } from "../../src/lib/kompasRepair.ts"
import { criteriaMisses } from "../../src/lib/kompasEvalCriteria.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const FIXTURE = JSON.parse(readFileSync(new URL("../fixtures/kompas-evaluation/interview-50.json", import.meta.url), "utf8"))
const HITACHI = Object.fromEntries(FIXTURE.filter((x) => x.chain === "hitachi-grc").map((x) => [x.step, x.question]))
const LEVELS = ["engineer", "director", "architect"]

test("keywords come from the topic, not the audience or the framing", () => {
  assert.equal(topicOfAsk(HITACHI[1]).includes("technical HR"), false)
  const words = questionKeywords(HITACHI[1]).map((w) => w.toLowerCase())
  assert.ok(words.some((w) => w.includes("nist")), words.join(","))
  for (const noise of ["keep", "suitable", "hr", "technical"]) assert.equal(words.includes(noise), false, noise)
  assert.equal(questionKeywords("Define residual risk.").some((w) => /\.$/.test(w)), false)
})

test("multi-part asks get a larger ceiling, capped at 1.3 times", () => {
  assert.equal(partsScale("What does residual risk mean?"), 1)
  assert.ok(partsScale(HITACHI[2]) > 1 && partsScale(HITACHI[2]) <= 1.3)
  const q2 = dissectQuestion(HITACHI[2])
  assert.ok(q2.modes.architect.maxWords > dissectQuestion("Design multi-cloud controls.").modes.architect.maxWords)
})

test("go deeper is a deep dive, not a short direct answer", () => {
  assert.equal(dissectQuestion(HITACHI[4]).shape, "technical-deep-dive")
  assert.ok(dissectQuestion(HITACHI[4]).modes.architect.maxWords >= 200)
})

test("the three mode ceilings stay at least 50% apart for every fixture question", () => {
  for (const item of FIXTURE) {
    const m = dissectQuestion(item.question).modes
    assert.ok(m.director.maxWords >= m.engineer.maxWords * 1.5 - 1, item.id)
    assert.ok(m.architect.maxWords >= m.director.maxWords * 1.5 - 1, item.id)
  }
})

test("a repaired sentence the question asked for survives the ceiling trim", () => {
  const text = "I would split controls per cloud. ".repeat(8) + "I rejected one shared policy engine because one outage would stop every cloud."
  const cut = trimToWords(text, 30, (s) => requiredSentence(HITACHI[2], s))
  assert.match(cut, /rejected one shared policy engine/)
  const h = "I start with the export. ".repeat(10) + "Hypothesis 1: the export is stale. Hypothesis 2: someone changed the setting."
  const kept = trimToWords(h, 25, (s) => requiredSentence(HITACHI[3], s))
  assert.match(kept, /Hypothesis 1:/)
  assert.match(kept, /Hypothesis 2:/)
})

test("settling keeps a fenced code block exactly as written, first", () => {
  const code = "```python\ndef open_after(findings, days=30):\n    return [f for f in findings if f.age > days]\n```"
  const out = settleSpokenAnswer("Write a Python function that returns the findings still open after 30 days.", `${code}\nIt filters by age.`, "engineer", RESUME, "", 40).text
  assert.ok(out.startsWith("```python"))
  assert.ok(out.includes("return [f for f in findings if f.age > days]"))
})

test("code questions are told to put the block first at every level", () => {
  const q = "Write a Python function that returns the findings still open after 30 days."
  assert.ok(asksForCode(q))
  assert.equal(asksForCode("What does residual risk mean?"), false)
  for (const level of LEVELS) assert.match(dissectionPrompt(q, level), /Code first at every level: one fenced, runnable block/)
  const judged = evaluateLiveAnswers([{ question: q, level: "engineer", text: "I would loop over the findings." }], RESUME)
  assert.ok(judged.failures.some((f) => /code question without a fenced block first/.test(f)))
})

test("the offline draft uses experience lines, never the resume header, and repeats no sentence", () => {
  const lines = experienceLines(RESUME)
  assert.ok(lines.length >= 10)
  assert.equal(lines.some((l) => /@|^fictional/i.test(l)), false)
  const questions = [
    "What does residual risk mean?",
    "What is the difference between a policy deviation and a policy exception?",
    "Tell me about a time you challenged a weak remediation plan.",
    "How do you assess business impact and residual risk?",
  ]
  const header = RESUME.split("\n").find((l) => l.trim()) || ""
  const rows = []
  for (const question of questions) for (const level of LEVELS) {
    const text = draftSpokenAnswer(question, level, RESUME)
    assert.equal(text.includes(header.replace(/^#+\s*/, "").trim()), false, `header in ${level}`)
    const said = sentencesOf(text).map((s) => s.toLowerCase())
    assert.equal(new Set(said).size, said.length, `repeated sentence in ${level}: ${question}`)
    rows.push({ question, level, text })
  }
  const judged = evaluateLiveAnswers(rows, RESUME)
  assert.deepEqual(judged.failures, [])
})

test("with nothing matching in the resume, the draft says so instead of reusing unrelated lines", () => {
  const text = draftSpokenAnswer(HITACHI[2], "engineer", "## Experience\n- Baked bread for a busy cafe every morning before six.\n")
  assert.match(text, /does not show this exact work/)
  assert.equal(/bread/.test(text), false)
})

test("two incidents that share a frame do not get one answer", () => {
  const worker = "In that design, a worker processes an object after its ownership changes. Walk through diagnosis, competing hypotheses, safe containment and rollback."
  const updater = "In that design, a signed updater launches an unsigned child used by a critical service. Walk through diagnosis, competing hypotheses, safe containment and rollback."
  assert.equal(leadPhrase(worker), "a worker processes an object after its ownership changes")
  assert.equal(leadPhrase(updater), "a signed updater launches an unsigned child used by a critical service")
  const rows = []
  for (const level of LEVELS) {
    const left = draftSpokenAnswer(worker, level, RESUME)
    const right = draftSpokenAnswer(updater, level, RESUME)
    assert.match(left, /worker/)
    assert.match(right, /updater/)
    assert.equal(/updater/.test(left), false, level)
    assert.equal(/worker/.test(right), false, level)
    assert.ok(sameAnswerRatio(left, right) < 1, `${level} ${sameAnswerRatio(left, right)}`)
    rows.push({ question: worker, level, text: left }, { question: updater, level, text: right })
  }
  assert.equal(evaluateLiveAnswers(rows, RESUME).failures.filter((f) => f.startsWith("same")).length, 0)
  assert.ok(sameAnswerRatio(draftSpokenAnswer(worker, "architect", RESUME), draftSpokenAnswer(updater, "architect", RESUME)) < 0.7)
  assert.equal(draftSpokenAnswer(worker, "architect", RESUME).includes("The boundary I watch"), false)
  const copied = "On in that design, here is what I do in practice. My resume does not show this exact work."
  const same = evaluateLiveAnswers([
    { question: worker, level: "engineer", text: copied },
    { question: updater, level: "engineer", text: copied },
  ], RESUME)
  assert.ok(same.failures.some((f) => /same answer for different questions/.test(f)))
})

test("a definition comparison does not reuse the shared closing catalog", () => {
  const idor = "Define IDOR versus CSRF. Keep it suitable for technical HR."
  const containment = "Define containment versus eradication. Keep it suitable for technical HR."
  for (const level of LEVELS) {
    const left = draftSpokenAnswer(idor, level, RESUME)
    const right = draftSpokenAnswer(containment, level, RESUME)
    assert.match(left, /IDOR versus CSRF/)
    assert.match(right, /containment versus eradication/)
    assert.equal(left.includes("The boundary I watch"), false, level)
    assert.equal(right.includes("The boundary I watch"), false, level)
  }
  const architect = sameAnswerRatio(draftSpokenAnswer(idor, "architect", RESUME), draftSpokenAnswer(containment, "architect", RESUME))
  const director = sameAnswerRatio(draftSpokenAnswer(idor, "director", RESUME), draftSpokenAnswer(containment, "director", RESUME))
  assert.ok(architect < 0.85, String(architect))
  assert.ok(director < 0.85, String(director))
})

test("two design questions leave the shared architect closing lines", () => {
  const door = "Design Front Door, APIM and private backend trust boundaries. Explain trust boundaries, data flow, failure isolation, rollout and validation."
  const tenant = "Design tenant isolation across API, cache and asynchronous workers. Explain trust boundaries, data flow, failure isolation, rollout and validation."
  const left = draftSpokenAnswer(door, "architect", RESUME)
  const right = draftSpokenAnswer(tenant, "architect", RESUME)
  assert.match(left, /Front Door/)
  assert.match(right, /tenant isolation/)
  assert.equal(left.includes("The boundary I watch"), false)
  assert.equal(right.includes("The boundary I watch"), false)
  assert.ok(wordCount(left) < 277, String(wordCount(left)))
  assert.ok(wordCount(right) < 281, String(wordCount(right)))
  const ratio = sameAnswerRatio(left, right)
  assert.ok(ratio < 0.85, String(ratio))
})

test("a director comparison does not reuse unrelated resume lines", () => {
  const accept = "Now explain the same incident to a director: risk acceptance versus remediation. State decision owner, business exposure and measures you would track, without inventing achieved numbers."
  const contain = "Now explain the same incident to a director: containment versus customer access. State decision owner, business exposure and measures you would track, without inventing achieved numbers."
  const left = draftSpokenAnswer(accept, "architect", RESUME)
  const right = draftSpokenAnswer(contain, "architect", RESUME)
  assert.match(left, /remediation/)
  assert.match(right, /containment versus customer access/)
  assert.equal(right.includes("worked on site"), false)
  assert.equal(right.includes("weekly risk summary"), false)
  const ratio = sameAnswerRatio(left, right)
  assert.ok(ratio < 0.7, String(ratio))
})

test("lead phrases and asked parts come from the interviewer's words", () => {
  assert.equal(leadPhrase("How do you assess business impact and residual risk?"), "assess business impact and residual risk")
  assert.match(leadPhrase(HITACHI[2]), /^design multi-cloud controls mapped to NIST 800-53$/)
  assert.deepEqual(askedPartList(HITACHI[2]), ["trust boundaries", "data flow", "failure isolation", "rollout", "validation"])
})

test("same-answer detection only compares the same level of different questions", () => {
  const text = "I map each finding to its control and send weak evidence back to the owner before closing it."
  const judged = evaluateLiveAnswers([
    { question: "What does residual risk mean?", level: "engineer", text },
    { question: "How do you assess business impact?", level: "engineer", text },
  ], RESUME)
  assert.ok(judged.failures.some((f) => /same answer for different questions/.test(f)))
  assert.ok(judged.failures.some((f) => /^provider error/.test(f)) === false)
})

test("number guard: structural numbers pass, result claims are guarded grammatically", () => {
  const none = new Set()
  const keep = (s, asked = new Set()) => applyGuards(s, null, none, asked).text
  for (const s of [
    "I mapped each control to NIST 800-53 AC-2 and AC-6.",
    "We moved the review from the first tier to the second tier in phase 2.",
    "I improved coverage by running the job at 02:00 every night.",
    "Hypothesis 1 held, and I improved the drift check so step 3 now runs first.",
    "I upgraded the library to 5.4.6 to close the finding.",
  ]) assert.equal(keep(s), s)
  assert.equal(keep("I reduced audit gaps by 40% in six months."), "I reduced audit gaps noticeably in six months.")
  const asked = questionFigures("You have 3 regions. How would you handle it?")
  assert.equal(keep("I secured the 3 regions with one baseline.", asked), "I secured the 3 regions with one baseline.")
  assert.equal(keep("I reduced incidents by 3 percent.", questionFigures("cut it by 3")).includes("by 3"), false)
})

test("the repair prompt no longer contradicts the ceiling or the tangent rule", () => {
  assert.doesNotMatch(STRUCTURE_REPAIR_SYSTEM, /Do not shorten it/)
  assert.match(STRUCTURE_REPAIR_SYSTEM, /never by dropping the missing element/)
  const p = structureRepairSystem(120, true)
  assert.match(p, /Stay within 120 words/)
  assert.match(p, /delete that jargon/)
  assert.doesNotMatch(structureRepairSystem(120, false), /delete that jargon/)
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(service, /repair = settleRepair\(job, repair, finalText\)/)
  assert.match(service, /type: "done", degraded, guarded: g\.guarded, verified, repaired, repair,/)
  assert.match(service, /ANSWER:\\n\$\{best\}/)
})

test("repair outcome: kept on any core fix, partial is visible, a later cut is reported", () => {
  assert.equal(judgeRewrite(["alt", "named"], ["named"], [], []), 1)
  assert.equal(judgeRewrite(["alt"], ["alt", "new"], [], []), 0)
  assert.equal(judgeRewrite([], [], ["a", "b"], ["b"]), 1)
  assert.equal(statusFor(1, 2, 1), "partial")
  assert.equal(statusFor(2, 2, 0), "landed")
  assert.equal(statusFor(0, 2, 2), "discarded")
  const outcome = { status: "landed", attempts: 1, missing: ["alt", "named"], stillMissing: [] }
  assert.deepEqual(lostAfterSettle(outcome, ["alt"]), ["alt"])
  assert.deepEqual(lostAfterSettle({ ...outcome, status: "discarded" }, ["alt"]), [])
})

test("hitachi-grc criteria: the pieces each question names are checked", () => {
  assert.deepEqual(criteriaMisses(HITACHI[2], "I map AC-2 per account under NIST 800-53. I rejected one shared policy engine because one outage would stop every cloud.").map((m) => m.check), [])
  assert.deepEqual(criteriaMisses(HITACHI[2], "I map controls per account.").map((m) => m.check), ["names NIST 800-53", "rejected alternative"])
  assert.deepEqual(criteriaMisses(HITACHI[3], "Hypothesis 1: the export is stale. Hypothesis 2: the setting changed. I roll back the change.").map((m) => m.check), [])
  assert.ok(criteriaMisses(HITACHI[3], "I compare the export with the setting.").some((m) => m.check === "Hypothesis 1 and Hypothesis 2 labels"))
  assert.deepEqual(criteriaMisses(HITACHI[4], "If the drift returns after the fix, then the pipeline is the cause. I stop when two clean runs pass.").map((m) => m.check), [])
  assert.deepEqual(criteriaMisses(HITACHI[5], "The business owner decides. I would track open exposure and time to close.").map((m) => m.check), [])
  assert.ok(criteriaMisses(HITACHI[5], "The owner decides. I reduced exposure by 40% last year. I track it.").some((m) => m.check === "no invented achieved numbers"))
})

test("the live eval reads the token from the environment only and covers the hitachi chain", () => {
  const source = readFileSync(new URL("../kompas-live-eval.mjs", import.meta.url), "utf8")
  assert.match(source, /process\.env\.KOMPAS_EVAL_TOKEN/)
  assert.match(source, /chain === "hitachi-grc"/)
  assert.match(source, /criteriaMisses/)
  assert.match(source, /warnings: judged\.warnings/)
  assert.match(source, /repairs:/)
  assert.doesNotMatch(source, /eyJ|writeFileSync/)
  assert.ok(wordCount(source) > 100)
})

test("settled answers drop visa, home address, and personal relocation the resume does not state", () => {
  const q = "What does residual risk mean?"
  const leaked = "Residual risk is what remains after the control. I need an H-1B and I live in Austin. I am open to relocation. My home address is 10 King Street. The owner decides what is left."
  const out = settleSpokenAnswer(q, leaked, "engineer", RESUME)
  assert.doesNotMatch(out.text, /H-1B|Austin|relocation|King Street/i)
  assert.match(out.text, /residual risk/i)
  assert.match(out.text, /owner decides/i)
  const moved = settleSpokenAnswer(q, "I relocated the Vault servers, then I checked the live setting.", "engineer", RESUME)
  assert.match(moved.text, /Vault servers/)
  const asked = settleSpokenAnswer("How does work authorization work?", "Work authorization is the legal permission to work. I need an H-1B.", "engineer", RESUME)
  assert.match(asked.text, /Work authorization is the legal permission/)
  assert.doesNotMatch(asked.text, /H-1B/)
  const judged = evaluateLiveAnswers([{ question: q, level: "engineer", text: leaked }], RESUME)
  assert.ok(judged.failures.some((f) => /ungrounded logistics/.test(f)))
})

test("a paraphrased repeat of the previous answer keeps only the new point", () => {
  const previous = "Residual risk is what remains after the planned control. I told the business what was left. The owner decides."
  const again = "After the planned control, residual risk is what remains. The owner decides, and I told the business what was left. A policy exception is a time-boxed approval with an owner and an end date."
  const kept = dropParaphrasedRepeat(again, previous)
  assert.match(kept, /policy exception/)
  assert.doesNotMatch(kept, /told the business/)
  const settled = settleSpokenAnswer("What is a policy exception?", again, "engineer", RESUME, previous)
  assert.match(settled.text, /policy exception/)
  assert.doesNotMatch(settled.text, /told the business/)
})

test("the stand-in puts one fenced block first for a code question", () => {
  const q = "Write a Python function that returns the findings still open after 30 days."
  for (const level of LEVELS) {
    const draft = draftSpokenAnswer(q, level, RESUME)
    assert.ok(draft.startsWith("```python\n"), level)
    assert.equal((draft.match(/```/g) || []).length, 2, level)
    const settled = settleSpokenAnswer(q, draft, level, RESUME)
    assert.ok(settled.text.startsWith("```python\n"), level)
    assert.ok(settled.words <= dissectQuestion(q, RESUME).modes[level].maxWords, `${level} ${settled.words}`)
  }
  assert.ok(standInFence("Write a SQL query that returns each customer's latest invoice.").startsWith("```sql\n"))
  assert.equal(draftSpokenAnswer("What does residual risk mean?", "engineer", RESUME).includes("```"), false)
})

test("a larger plan cannot leave a spoken answer past the mode ceiling", () => {
  const q = "What does residual risk mean?"
  const long = "Residual risk is what remains after the planned control. ".repeat(20)
  const band = dissectQuestion(q, RESUME).modes.engineer.maxWords
  const out = settleSpokenAnswer(q, long, "engineer", RESUME, "", 400)
  assert.ok(wordCount(out.text) <= band, `${wordCount(out.text)} > ${band}`)
  assert.match(out.text, /residual risk/i)
})

test("an answer that buries the question opens on the question's words", () => {
  const q = "What does residual risk mean?"
  const buried = "I would start with the owner and the ticket. Residual risk is what remains after the planned control. The owner decides what is left."
  const out = settleSpokenAnswer(q, buried, "engineer", RESUME)
  assert.match(out.text, /^Residual risk is what remains/)
  assert.match(out.text, /start with the owner/)
})

test("gateway sentences are not answers, and a real sentence that mentions a failure still is", () => {
  for (const raw of [
    "Something went wrong. Please try again.",
    "The AI service is unavailable.",
    "Sorry, the model failed to respond.",
    "We couldn't generate a response. Please retry.",
    "Anthropic is experiencing high demand.",
  ]) {
    assert.equal(isProviderErrorAnswer(raw), true, raw)
    assert.equal(settleSpokenAnswer("What does residual risk mean?", raw, "engineer", RESUME).providerError, true, raw)
  }
  assert.equal(isProviderErrorAnswer("I would rate limit the scanner so a 429 does not stop the review."), false)
  assert.equal(isProviderErrorAnswer("Something went wrong with the export, so I checked the live setting."), false)
})
