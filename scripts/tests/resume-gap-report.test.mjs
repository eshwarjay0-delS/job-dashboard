import test from "node:test"
import assert from "node:assert/strict"
import { buildResumeGapReport } from "../../src/lib/resume-gap-report.ts"

test("separates exported-DOCX keyword gaps from requirements without candidate evidence", () => {
  const report = buildResumeGapReport({
    coverage: 88.4,
    supported_coverage: 96.2,
    quality: { missing: ["Kubernetes", "CISM"] },
    keyword_analysis: { missing: ["stale value that must not win"] },
    unsupported_keywords: ["CISM", "Canton"],
    unverified_added_keywords: ["Canton"],
    role_alignment: [{
      role: "Security Analyst",
      bullets: 5,
      rewritten: 2,
      added: 1,
      skills: 3,
      required: 4,
    }],
    enrichment_suggested: ["Zero Trust", "Canton"],
    enrichment_placed: ["Zero Trust"],
    enrichment_blocked: ["Canton"],
    ats: { passed: false, issues: ["substantive: insufficient body text"] },
    quality_blockers: ["role_evidence_gaps"],
  })

  assert.equal(report.coverage, 88.4)
  assert.equal(report.supportedCoverage, 96.2)
  assert.deepEqual(report.missingKeywords, ["Kubernetes", "CISM"])
  assert.deepEqual(report.unsupportedRequirements, ["CISM", "Canton"])
  assert.deepEqual(report.unverifiedClaims, ["Canton"])
  assert.deepEqual(report.roles, [{
    role: "Security Analyst",
    bullets: 5,
    rewritten: 2,
    added: 1,
    skills: 3,
    required: 4,
  }])
  assert.deepEqual(report.enrichment, {
    suggested: ["Zero Trust", "Canton"],
    placed: ["Zero Trust"],
    blocked: ["Canton"],
  })
  assert.equal(report.atsPassed, false)
  assert.deepEqual(report.atsIssues, ["substantive: insufficient body text"])
  assert.deepEqual(report.qualityBlockers, ["role_evidence_gaps"])
  assert.equal(report.hasEvidence, true)
})

test("uses the exported DOCX recount as the authoritative missing-keyword list", () => {
  const report = buildResumeGapReport({
    quality: { missing: [] },
    keyword_analysis: { missing: ["not missing from the exported file"], coverage_after: 100 },
  })

  assert.equal(report.coverage, 100)
  assert.deepEqual(report.missingKeywords, [])
})

test("supports older result records without an exported quality report", () => {
  const report = buildResumeGapReport({
    keyword_analysis: { missing: ["AWS", "Terraform"], coverage_after: 75 },
    unsupported_keywords: ["Terraform"],
  })

  assert.equal(report.coverage, 75)
  assert.equal(report.supportedCoverage, null)
  assert.deepEqual(report.missingKeywords, ["AWS", "Terraform"])
  assert.deepEqual(report.unsupportedRequirements, ["Terraform"])
  assert.equal(report.hasEvidence, true)
})

test("does not infer experience evidence from a keyword gap or a Gemini suggestion", () => {
  const report = buildResumeGapReport({
    quality: { missing: ["Kubernetes"] },
    enrichment_suggested: ["Kubernetes"],
    enrichment_blocked: ["Kubernetes"],
  })

  assert.deepEqual(report.missingKeywords, ["Kubernetes"])
  assert.deepEqual(report.unsupportedRequirements, [])
  assert.deepEqual(report.unverifiedClaims, [])
  assert.deepEqual(report.enrichment?.blocked, ["Kubernetes"])
})

test("normalizes malformed fields and rejects invalid percentages", () => {
  const report = buildResumeGapReport({
    coverage: 101,
    supported_coverage: -1,
    quality: { missing: [" AWS ", "aws", null, ""] },
    unsupported_keywords: "GCP",
    role_alignment: [{ role: "   ", bullets: 3 }, { role: "Cloud Engineer", bullets: -1, skills: 2.8, required: 4 }],
    ats: { passed: "yes", issues: [null, " contact: missing "] },
    quality_blockers: [" ats_check_failed ", "ats_check_failed"],
  })

  assert.equal(report.coverage, null)
  assert.equal(report.supportedCoverage, null)
  assert.deepEqual(report.missingKeywords, ["AWS"])
  assert.deepEqual(report.unsupportedRequirements, [])
  assert.deepEqual(report.roles, [{
    role: "Cloud Engineer",
    bullets: 0,
    rewritten: 0,
    added: 0,
    skills: 2,
    required: 4,
  }])
  assert.equal(report.atsPassed, null)
  assert.deepEqual(report.atsIssues, ["contact: missing"])
  assert.deepEqual(report.qualityBlockers, ["ats_check_failed"])
})

test("an empty or absent result produces no misleading report", () => {
  assert.equal(buildResumeGapReport(null).hasEvidence, false)
  assert.equal(buildResumeGapReport({}).hasEvidence, false)
})
