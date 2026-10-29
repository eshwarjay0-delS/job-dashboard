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
const { resumeQuality } = loadTS("src/lib/resume-quality.ts")
const { acceptableWhatsAppResume, whatsappResumeRejectionReasons } = loadTS("src/lib/whatsapp-resume-acceptance.ts")
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
test("84.3% of the job post is not delivered even when supported skills are 100%", () => {
  const draft = make({ coverage: 84.3 })
  assert.equal(acceptableWhatsAppResume(draft), false)
  assert.ok(whatsappResumeRejectionReasons(draft).includes("jd_coverage_below_floor"))
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
