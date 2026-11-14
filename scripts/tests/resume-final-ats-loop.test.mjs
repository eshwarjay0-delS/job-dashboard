import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tailor = readFileSync("src/lib/tailor.ts", "utf8");
const claude = readFileSync("src/lib/claude.ts", "utf8");
const review = readFileSync("src/lib/resume-final-ats-review.ts", "utf8");

test("the final review reads the actual exported DOCX and runs before result scoring", () => {
  assert.match(tailor, /exportedForReview = await docxText\(best\.buffer\)/);
  assert.match(tailor, /reviewFinalDocxWithGemini\(\{/);
  assert.match(tailor, /terms: jdExtracted/);
  assert.ok(tailor.indexOf("reviewFinalDocxWithGemini({") < tailor.indexOf("const { edits, buffer, notes, afterKw } = best"));
  assert.match(tailor, /gemini_ats_review: geminiAtsReview/);
});

test("the correction loop is bounded and uses only evidence-filtered terms", () => {
  assert.match(tailor, /reviewRound <= 2/);
  assert.match(tailor, /supportedFinalAtsGaps\(review, forcedJdKws, best\.afterKw\)/);
  assert.match(tailor, /fillGaps\(current, 1, repairLimit, supportedGaps, weakSupported, new Set\(confirmedJdKws\)\)/);
  assert.match(tailor, /restoreUnsupportedRoleEdits\(/);
  assert.match(tailor, /dropInventedExperienceEdits\(/);
  assert.match(review, /Only source\/confirmation-backed terms can be sent to the correction pass/);
});

test("Gemini is pinned as the only provider and its score remains diagnostic", () => {
  assert.match(claude, /keys: \{ gemini: opts\.keys\.gemini \}/);
  assert.match(claude, /pref: "gemini"/);
  assert.match(claude, /purpose: "resume-ats-review"/);
  assert.match(tailor, /Gemini final-DOCX ATS score: /);
  assert.match(tailor, /deterministic exported-document coverage and evidence gates remain authoritative/);
  assert.doesNotMatch(tailor, /geminiAtsReview\.score\s*\/\s*100[^;]*qualityReport/);
});


test("final corrections preserve the confirmed-skill boundary and target weak supported terms", () => {
  assert.match(tailor, /forceTerms: readonly string\[\] = \[\]/)
  assert.match(tailor, /const weakSupported = supportedGaps\.filter/)
  assert.match(tailor, /sourceMissing = missingRoleEvidenceTerms[\s\S]*filter\(term => !focus \|\| focus\.has\(term\.toLowerCase\(\)\)\)/)
  assert.match(tailor, /confirmedSkillFitsBullet\(term, b\.text, coveredJdKeywords\)/)
  assert.match(tailor, /restoreUnsupportedRoleEdits\([\s\S]*new Set\(confirmedJdKws\)/)
  assert.match(tailor, /Gemini final-DOCX ATS score: /)
  assert.match(tailor, /deterministic exported-document coverage and evidence gates remain authoritative/)
})
