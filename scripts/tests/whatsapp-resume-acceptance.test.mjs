import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
function loadTS(rel) {
  const source = readFileSync(resolve(root, rel), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, require }, { filename: rel })
  return exports
}
// TAILOR_DELIVER_WITH_SHORTFALL=0: the earlier under-95% refusal (blueprint 2026-10-30 delivers with the shortfall listed).
function loadRefusing(rel) {
  const source = readFileSync(resolve(root, rel), "utf8")
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, require, process: { env: { TAILOR_DELIVER_WITH_SHORTFALL: "0" } } })
  return exports
}
const refusing = loadRefusing("src/lib/whatsapp-resume-acceptance.ts")
const { resumeQuality } = loadTS("src/lib/resume-quality.ts")
const { acceptableWhatsAppResume, whatsappResumeRejectionReasons } = loadTS("src/lib/whatsapp-resume-acceptance.ts")
const { removeUnsupportedRewrites } = loadTS("src/lib/resume-unsupported-rewrites.ts")
const make = (changes = {}) => ({
  token: "safe-docx-token", coverage: 100, supported_coverage: 100,
  diff: [{ section: "Experience", before: "A", after: "B" }],
  quality: resumeQuality({ matched: 13, total: 13, missing: [], partial: false }),
  unverified_added_keywords: [], quality_blockers: [],
  ...changes,
})
const rejects = (name, changes, reason) => test(name, () => {
  const draft = make(changes)
  assert.equal(acceptableWhatsAppResume(draft), false)
  assert.ok(whatsappResumeRejectionReasons(draft).includes(reason))
})

test("100% of the job post and 100% of supported skills is deliverable", () => {
  const draft = make()
  assert.equal(draft.quality.status, "coverage_met")
  assert.equal(acceptableWhatsAppResume(draft), true)
})
test("switch off: 84.3% of the job post is not delivered even when supported skills are 100%", () => {
  const draft = make({ coverage: 84.3 })
  assert.equal(refusing.acceptableWhatsAppResume(draft), false)
  assert.ok(refusing.whatsappResumeRejectionReasons(draft).includes("jd_coverage_below_floor"))
})
test("switch on: a complete 84.3% draft is delivered with the shortfall listed, not refused", () => {
  const draft = make({ coverage: 84.3 })
  assert.equal(whatsappResumeRejectionReasons(draft).includes("jd_coverage_below_floor"), false)
})
test("95% supported complete draft ships with honestly disclosed gaps", () => {
  const draft = make({
    coverage: 95,
    supported_coverage: 95,
    quality: resumeQuality({ matched: 19, total: 20, missing: ["unsupported gap"], partial: false }),
  })
  assert.equal(draft.quality.status, "delivered_with_gaps")
  assert.equal(acceptableWhatsAppResume(draft), true)
})
test("98% supported complete draft meets target", () => {
  const draft = make({
    coverage: 98,
    supported_coverage: 98,
    quality: resumeQuality({ matched: 49, total: 50, missing: ["gap"], partial: false }),
  })
  assert.equal(draft.quality.status, "coverage_met")
  assert.equal(acceptableWhatsAppResume(draft), true)
})
test("incomplete 100% keyword draft is never marked delivered_with_gaps", () => {
  const quality = resumeQuality({ matched: 13, total: 13, missing: [], partial: true })
  assert.equal(quality.status, "needs_review")
  assert.equal(quality.incomplete, true)
  assert.equal(acceptableWhatsAppResume(make({ quality })), false)
})
rejects("incomplete cached report rejected even with legacy deliverable status", {
  quality: { ...resumeQuality({ matched: 13, total: 13, missing: [] }), incomplete: true },
}, "quality_incomplete")
rejects("unverified JD claims are rejected independently of score", {
  unverified_added_keywords: ["Unverified Product"],
}, "unverified_jd_terms")
rejects("missing role rewrite is rejected independently of score", {
  quality_blockers: ["roles_unrewritten"],
}, "roles_unrewritten")
rejects("a skills-only file under 95% of the job post is not delivered", {
  skills_only: true,
  coverage: 84.3,
}, "jd_coverage_below_floor")
test("a skills-only file that reaches 95% of the job post can be delivered", () => {
  assert.equal(acceptableWhatsAppResume(make({ skills_only: true, coverage: 100 })), true)
})
rejects("failed draft parts are not a completed tailored document", {
  partial: { failed: 1, total: 5 },
}, "draft_parts_missing")
rejects("unchanged source is not a tailored resume", {
  unchanged: true,
}, "unchanged")
rejects("no actual diff is not a tailored resume", {
  diff: [],
}, "unchanged")
rejects("missing document token is rejected", {
  token: "",
}, "no_document_token")
rejects("94.9% supported is below the floor", {
  supported_coverage: 94.9,
  quality: resumeQuality({ matched: 949, total: 1000, missing: ["gap"] }),
}, "supported_coverage_below_floor")
rejects("stale cache cannot report 100% when quality counts are 50%", {
  supported_coverage: 100,
  quality: resumeQuality({ matched: 1, total: 2, missing: ["gap"] }),
}, "supported_score_mismatch")
rejects("zero evidenced JD requirements cannot become an automatic 100%", {
  supported_coverage: 100,
  quality: resumeQuality({ matched: 0, total: 0, missing: [] }),
}, "invalid_supported_denominator")
rejects("invalid numerator cannot pass", {
  quality: { ...resumeQuality({ matched: 13, total: 13, missing: [] }), matched: 14 },
}, "invalid_supported_denominator")
rejects("quality report missing cannot pass", { quality: undefined }, "quality_report_missing")
rejects("invalid quality status cannot pass", {
  quality: { ...resumeQuality({ matched: 13, total: 13, missing: [] }), status: "needs_review" },
}, "quality_not_deliverable")
test("partial reports remain needs_review at 95% and 98%", () => {
  for (const [matched, total] of [[19, 20], [49, 50], [100, 100]]) {
    assert.equal(resumeQuality({ matched, total, missing: [], partial: true }).status, "needs_review")
  }
})
test("invalid weighted ratio never passes the quality floor", () => {
  assert.equal(resumeQuality({ matched: 10, total: 10, missing: [], weightedCoverage: 1.5 }).status, "needs_review")
})

test("unsupported JD-only work claim restores the entire original bullet, not just the tool name", () => {
  const original = {
    bullets: [
      { idx: 11, text: "Built an unsupported-product security program for a client" },
      { idx: 12, text: "Improved evidenced IAM policy troubleshooting" },
    ],
    skills: [{ idx: 20, text: "IAM and audit evidence" }],
  }
  const cleaned = removeUnsupportedRewrites(original, text => text.includes("unsupported-product"))
  assert.equal(cleaned.removed, 1)
  assert.equal(cleaned.edits.bullets.length, 1)
  assert.equal(cleaned.edits.bullets[0].idx, 12)
  assert.equal(cleaned.edits.bullets[0].text, "Improved evidenced IAM policy troubleshooting")
  assert.equal(original.bullets.length, 2)
})
test("unsupported JD-only claims in every editable section are reverted, preserving evidenced edits", () => {
  const edits = {
    headline: { title: "unsupported-product specialist", tagline: "Verified security engineering" },
    summary: "Led unsupported-product deployments",
    skills: [{ idx: 1, text: "unsupported-product" }, { idx: 2, text: "IAM" }],
    bullets: [{ idx: 3, text: "Implemented unsupported-product" }, { idx: 4, text: "Reviewed access controls" }],
    extras: [{ idx: 5, text: "unsupported-product certification" }],
    added: [{ after: 4, text: "Used unsupported-product at a bank" }],
  }
  const cleaned = removeUnsupportedRewrites(edits, text => text.includes("unsupported-product"))
  assert.equal(cleaned.removed, 6)
  assert.equal(cleaned.edits.headline.title, "")
  assert.equal(cleaned.edits.headline.tagline, "Verified security engineering")
  assert.equal(cleaned.edits.summary, "")
  assert.equal(cleaned.edits.skills.length, 1)
  assert.equal(cleaned.edits.skills[0].text, "IAM")
  assert.equal(cleaned.edits.bullets.length, 1)
  assert.equal(cleaned.edits.bullets[0].idx, 4)
  assert.equal(cleaned.edits.extras.length, 0)
  assert.equal(cleaned.edits.added.length, 0)
})
test("evidence-supported edits remain unchanged and no rewrite is fabricated by the sanitizer", () => {
  const edits = { bullets: [{ idx: 1, text: "Documented existing AWS IAM access controls" }] }
  const cleaned = removeUnsupportedRewrites(edits, text => text.includes("unsupported-product"))
  assert.equal(cleaned.removed, 0)
  assert.equal(cleaned.edits, edits)
})
test("sanitizing an unsafe claim cannot override the independent role-completeness gate", () => {
  const unsafe = make({ quality_blockers: ["roles_unrewritten"] })
  assert.equal(acceptableWhatsAppResume(unsafe), false)
  assert.ok(whatsappResumeRejectionReasons(unsafe).includes("roles_unrewritten"))
})

// Job-post terms switch (JD_TERMS_ALWAYS_ON_SKILLS, default on). Eshwar, 29 Oct 2026: "If it is mentioned in JD that
// presented then it is our responsibility to include it in the updated resume every time".
const loadWithEnv = (rel, env) => {
  const source = readFileSync(resolve(root, rel), "utf8")
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, require, process: { env } })
  return exports
}
const unplaced = {
  coverage: 70, supported_coverage: 100, unverified_added_keywords: [],
  quality: resumeQuality({ matched: 7, total: 10, missing: ["gcp security", "gcp iam", "production"], partial: false }),
  jd_terms_unplaced: ["gcp security", "gcp iam", "production"], jd_terms_unplaced_reason: "skills_locked",
}
test("switch on: locked skills or no skills section sends the file with the terms in the reply, not a coverage refusal", () => {
  assert.equal(whatsappResumeRejectionReasons(make(unplaced)).includes("jd_coverage_below_floor"), false)
  assert.equal(acceptableWhatsAppResume(make(unplaced)), true)
  assert.equal(acceptableWhatsAppResume(make({ ...unplaced, jd_terms_unplaced_reason: "no_skills_section" })), true)
})
test("switch on: the locked/no-skills exemption covers the coverage shortfall only", () => {
  assert.ok(refusing.whatsappResumeRejectionReasons(make({ ...unplaced, jd_terms_unplaced_reason: undefined })).includes("jd_coverage_below_floor"))
  assert.equal(acceptableWhatsAppResume(make({ ...unplaced, quality_blockers: ["roles_unrewritten"] })), false)
  assert.equal(acceptableWhatsAppResume(make({ ...unplaced, partial: { failed: 1, total: 5 } })), false)
  assert.equal(acceptableWhatsAppResume(make({ ...unplaced, quality: { ...unplaced.quality, incomplete: true } })), false)
  assert.equal(refusing.acceptableWhatsAppResume(make({ ...unplaced, jd_terms_unplaced: [] })), false)
})
test("switch off (JD_TERMS_ALWAYS_ON_SKILLS=0) restores the coverage refusal", () => {
  const off = loadWithEnv("src/lib/whatsapp-resume-acceptance.ts", { JD_TERMS_ALWAYS_ON_SKILLS: "0" })
  assert.ok(off.whatsappResumeRejectionReasons(make(unplaced)).includes("jd_coverage_below_floor"))
  assert.equal(off.acceptableWhatsAppResume(make(unplaced)), false)
})
test("switch on: a placed job-post term on the skills line survives the rollback; in a bullet, summary or headline it is reverted", () => {
  const edits = {
    headline: { title: "gcp iam specialist", tagline: "Security engineering" },
    summary: "Led gcp iam programs",
    skills: [{ idx: 1, text: "Cloud: AWS, gcp security, gcp iam" }, { idx: 2, text: "IAM" }],
    bullets: [{ idx: 3, text: "Built gcp iam controls" }, { idx: 4, text: "Reviewed access controls" }],
    extras: [{ idx: 5, text: "gcp iam certification" }],
    added: [{ after: 4, text: "Used gcp iam at a bank" }],
  }
  const cleaned = removeUnsupportedRewrites(edits, text => text.includes("gcp iam"), { keepSkills: true })
  assert.equal(cleaned.removed, 5)
  assert.deepEqual(cleaned.edits.skills, edits.skills)
  assert.equal(cleaned.edits.headline.title, "")
  assert.equal(cleaned.edits.headline.tagline, "Security engineering")
  assert.equal(cleaned.edits.summary, "")
  assert.deepEqual(cleaned.edits.bullets.map(b => b.idx), [4])
  assert.equal(cleaned.edits.extras.length, 0)
  assert.equal(cleaned.edits.added.length, 0)
})
test("switch off: a placed gcp iam on the skills line is stripped, as master does", () => {
  const edits = { skills: [{ idx: 1, text: "Cloud: AWS, gcp iam" }, { idx: 2, text: "IAM" }] }
  const off = removeUnsupportedRewrites(edits, text => text.includes("gcp iam"), { keepSkills: false })
  assert.equal(off.removed, 1)
  assert.deepEqual(off.edits.skills.map(s => s.idx), [2])
  assert.deepEqual(removeUnsupportedRewrites(edits, text => text.includes("gcp iam")).edits.skills.map(s => s.idx), [2])
})
