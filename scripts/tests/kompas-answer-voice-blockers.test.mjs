// Production blockers: default persona file, per-level bands, multi-part IAM coverage.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  BANDS,
  EVAL_CASES,
  assessAnswer,
  employmentViolations,
  fallbackAnswer,
  houstonResume,
  srCyberResumeLookup,
  wordCount,
} from "../../src/lib/kompasLevelPersonality.ts"

const IAM = EVAL_CASES.find((item) => item.id === "iam").question
const INTRO = "Tell me about yourself."

test("the Sr Cybersecurity Engineer resume file is not in the repo", () => {
  const found = srCyberResumeLookup()
  assert.equal(found.found, false)
  assert.equal(found.path, null)
  assert.equal(found.missingName, "Eshwar_Resume_Sr_Cybersecurity_Engineer")
  const resume = houstonResume()
  assert.match(resume, /eshwarjay05@gmail.com/)
  assert.match(resume, /Fortinet AWS Cloud Networking Engineer/)
  assert.doesNotMatch(resume, /jayeshwar44|saint louis/i)
  assert.doesNotMatch(resume, /Sr Cybersecurity Engineer/)
})

test("three levels land in band and do not share one voice", () => {
  const texts = {}
  for (const level of ["architect", "director", "engineer"]) {
    const text = fallbackAnswer(level, INTRO)
    const check = assessAnswer(INTRO, level, text)
    assert.equal(check.ok, true, JSON.stringify({ level, words: check.words, style: check.styleHits, hedges: check.hedgeHits }))
    assert.ok(check.words >= BANDS[level].min && check.words <= BANDS[level].max)
    texts[level] = text
  }
  assert.ok(texts.architect.length > texts.director.length)
  assert.ok(texts.engineer.length > texts.director.length)
  assert.doesNotMatch(texts.director, /FortiGate|FortiManager|Gateway Load Balancer|Transit Gateway/)
  assert.match(texts.architect, /FortiGate/)
  assert.match(texts.engineer, /plain language|glad to talk/)
  assert.notEqual(texts.architect.slice(0, 80), texts.engineer.slice(0, 80))
  assert.notEqual(texts.architect.slice(0, 80), texts.director.slice(0, 80))
})

test("the IAM question answers every part without making Saviynt an employer", () => {
  for (const level of ["architect", "director", "engineer"]) {
    const text = fallbackAnswer(level, IAM)
    const check = assessAnswer(IAM, level, text)
    assert.equal(check.ok, true, JSON.stringify({ level, words: check.words, topic: check.topic, employer: check.employerHits }))
    assert.match(text, /IAM|identity/i)
    assert.match(text, /implement|integrated/i)
    assert.match(text, /Saviynt/)
    assert.match(text, /customer|partner/i)
    assert.deepEqual(employmentViolations(text), [])
    assert.doesNotMatch(text, /I worked at Saviynt|employed by Saviynt|joined Saviynt/i)
    assert.doesNotMatch(text, /jayeshwar44|Accenture|Charter Communications/i)
  }
})

test("committed blocker eval matches this run", () => {
  const md = readFileSync(new URL("../../docs/kompas-eval/blockers-results.md", import.meta.url), "utf8")
  assert.match(md, /Eshwar_Resume_Sr_Cybersecurity_Engineer/)
  assert.match(md, /not in the repo/)
  assert.match(md, /Live model samples were not produced/)
  for (const level of ["architect", "director", "engineer"]) {
    const words = wordCount(fallbackAnswer(level, INTRO))
    assert.match(md, new RegExp(`intro \\| ${level} \\| ${words} \\| pass`))
    const iamWords = wordCount(fallbackAnswer(level, IAM))
    assert.match(md, new RegExp(`iam \\| ${level} \\| ${iamWords} \\| pass`))
  }
})
