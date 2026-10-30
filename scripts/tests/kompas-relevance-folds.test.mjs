// Code-level checks for the 29 Oct 2026 relevance folds. These prove the code paths, not live answer quality:
// live quality is only measured by scripts/kompas-live-eval.mjs with a real token.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  askedPartList, asksForCode, dissectQuestion, dissectionPrompt, draftSpokenAnswer, evaluateLiveAnswers,
  experienceLines, leadPhrase, partsScale, questionKeywords, requiredSentence, sentencesOf, settleSpokenAnswer,
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
