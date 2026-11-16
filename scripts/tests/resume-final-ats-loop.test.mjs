import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const tailor = readFileSync("src/lib/tailor.ts", "utf8")
const claude = readFileSync("src/lib/claude.ts", "utf8")
const evidence = readFileSync("src/lib/resume-evidence.ts", "utf8")
const review = readFileSync("src/lib/resume-final-ats-review.ts", "utf8")

test("the reviewer reads the actual exported DOCX bytes before final result scoring", () => {
  assert.match(tailor, /exportedForReview = await docxText\\(best\\.buffer\\)/)
  assert.match(tailor, /reviewFinalDocxWithGemini\\(\\{/)
  assert.match(tailor, /terms: jdExtracted/)
  assert.ok(tailor.indexOf("reviewFinalDocxWithGemini({") < tailor.indexOf("const { edits, buffer, notes, afterKw } = best"))
  assert.match(tailor, /gemini_ats_review: geminiAtsReview/)
})

test("the correction loop has at most two corrections and re-reviews each re-export", () => {
  assert.match(tailor, /reviewRound <= 2/)
  assert.match(tailor, /supportedFinalAtsGaps\\(review, forcedJdKws, best\\.afterKw\\)/)
  assert.match(tailor, /fillGaps\\(current, 1, repairLimit, supportedGaps, weakSupported, new Set\\(confirmedJdKws\\)\\)/)
  assert.match(tailor, /candidate = await stripAddedCerts\\(candidate\\)/)
  assert.match(tailor, /restoreUnsupportedRoleEdits\\(/)
  assert.match(tailor, /dropInventedExperienceEdits\\(/)
  assert.match(review, /Only source\\/confirmation-backed terms may enter a correction pass/)
})

test("confirmed skills retain the cross-role project-context boundary", () => {
  assert.match(evidence, /export function confirmedSkillFitsBullet\\(/)
  assert.match(tailor, /confirmedSkillFitsBullet\\(term, b\\.text, coveredJdKeywords\\)/)
  assert.match(tailor, /sections: focus \\? \\{ \\.\\.\\.sec, summary: false, headline: false \\} : sec/)
})

test("Gemini is the only reviewer provider and its score never controls deterministic quality", () => {
  assert.match(claude, /keys: \\{ gemini: opts\\.keys\\.gemini \\}/)
  assert.match(claude, /pref: "gemini"/)
  assert.match(claude, /purpose: "resume-ats-review"/)
  assert.match(tailor, /diagnostic only; deterministic coverage and candidate evidence remain authoritative/)
  assert.doesNotMatch(tailor, /geminiAtsReview\\.score[^\\n]*qualityReport/)
})
