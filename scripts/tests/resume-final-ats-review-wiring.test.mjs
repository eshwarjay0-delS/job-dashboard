import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tailor = readFileSync("src/lib/tailor.ts", "utf8");
const claude = readFileSync("src/lib/claude.ts", "utf8");

test("the one-shot diagnostic reads the actual exported DOCX bytes", () => {
  assert.match(tailor, /const exportedForReview = await docxText\(best\.buffer\)/);
  assert.match(tailor, /reviewFinalDocxWithGemini\(\{/);
  assert.match(tailor, /terms: jdExtracted/);
  assert.match(tailor, /gemini_ats_review: geminiAtsReview/);
  assert.match(claude, /purpose: "resume-ats-review"/);
});

test("Gemini is diagnostic only and does not change coverage, experience, or delivery gates", () => {
  assert.match(tailor, /Gemini final-DOCX ATS score: .*diagnostic only/);
  assert.match(tailor, /deterministic exported-DOCX coverage and existing quality gates remain authoritative/);
  assert.doesNotMatch(tailor, /supportedFinalAtsGaps|unsupportedFinalAtsGaps|Gemini-guided evidence-only correction/);
  assert.doesNotMatch(tailor, /geminiAtsReview\.score[^\n]*(?:RESUME_MIN_COVERAGE|qualityBlockers|coverage\s*=)/);
});

test("incomplete or skills-only drafts skip the diagnostic rather than being represented as complete", () => {
  assert.match(tailor, /if \(best\.partial \|\| skillsOnly\)/);
  assert.match(tailor, /geminiAtsReview\.status = "skipped_incomplete"/);
});
