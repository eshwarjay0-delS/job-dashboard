// WhatsApp refusal 30 Oct 2026 10:40 AM CT (Salesforce Security Specialist): the job-post terms rollback restored every
// paragraph. Restored source text must never be mistaken for a complete tailored experience rewrite.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const src = rel => readFileSync(resolve(root, rel), "utf8").replace(/\r\n/g, "\n")
function load(rel, env = {}) {
  const compiled = ts.transpileModule(src(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, require, process: { env } }, { filename: rel })
  return exports
}
const MOD = "src/lib/tailor-ship-on-rollback.ts"
const { resumeQuality } = load("src/lib/resume-quality.ts")

// Shape of the live 10:40 AM case: 5 roles, gate on, the rollback restored paragraphs, nothing rewritten.
const live = { splitDraft: true, skillsOnly: false, lackingRoleCount: 5, experienceComplete: false, jdGate: true, bulletsReverted: 9 }

test("bug: the shipped module exists and tailor.ts builds its role blockers through it", () => {
  assert.ok(existsSync(resolve(root, MOD)), "tailor-ship-on-rollback.ts missing")
  const t = src("src/lib/tailor.ts")
  assert.match(t, /roleQualityBlockers\(\{/)
  assert.doesNotMatch(t, /lackingRoles\(best\.edits\)\.length \? \["roles_unrewritten"\]/)
})

test("rollback-restored roles still require evidence and rewrites", () => {
  const m = load(MOD)
  assert.deepEqual([...m.roleQualityBlockers(live, {})], ["roles_unrewritten", "role_evidence_gaps"])
})

test("incomplete 0% draft is rejected, not sent with a shortfall label", () => {
  const m = load(MOD)
  const acc = load("src/lib/whatsapp-resume-acceptance.ts")
  const result = {
    token: "t", coverage: 0, supported_coverage: 100, diff: [{ section: "Skills", before: "A", after: "B" }],
    quality: resumeQuality({ matched: 0, total: 8, missing: ["siem", "aws", "okta"], partial: m.roleQualityBlockers(live, {}).length > 0 }),
    unverified_added_keywords: [], quality_blockers: m.roleQualityBlockers(live, {}), bullets_reverted_for_jd_terms: 9,
  }
  const reasons = acc.whatsappResumeRejectionReasons(result)
  for (const blocker of ["quality_incomplete", "roles_unrewritten", "role_evidence_gaps"])
    assert.ok(reasons.includes(blocker), blocker)
  assert.equal(acc.deliveredWithShortfall(result), false)
})

test("legacy switch off still blocks incomplete experience", () => {
  for (const v of ["0", "false", "off", "no"]) {
    const m = load(MOD, { TAILOR_SHIP_ON_ROLLBACK: v })
    assert.deepEqual([...m.roleQualityBlockers(live)], ["roles_unrewritten", "role_evidence_gaps"])
  }
})

test("rollback or JD gate cannot excuse missing roles; complete roles pass", () => {
  const m = load(MOD)
  assert.deepEqual([...m.roleQualityBlockers({ ...live, bulletsReverted: 0 }, {})], ["roles_unrewritten", "role_evidence_gaps"])
  assert.deepEqual([...m.roleQualityBlockers({ ...live, jdGate: false }, {})], ["roles_unrewritten", "role_evidence_gaps"])
  assert.deepEqual([...m.roleQualityBlockers(live, { TAILOR_SHIP_ON_ROLLBACK: "1" })], ["roles_unrewritten", "role_evidence_gaps"])
  assert.deepEqual([...m.roleQualityBlockers({ ...live, splitDraft: false }, {})], [])
  assert.deepEqual([...m.roleQualityBlockers({ ...live, skillsOnly: true }, {})], [])
  assert.deepEqual([...m.roleQualityBlockers({ ...live, bulletsReverted: 0, lackingRoleCount: 0, experienceComplete: true }, {})], [])
})

test("TAILOR_DELIVER_WITH_SHORTFALL=0 still refuses under 95% (that switch keeps its meaning)", () => {
  const m = load(MOD)
  const acc = load("src/lib/whatsapp-resume-acceptance.ts", { TAILOR_DELIVER_WITH_SHORTFALL: "0" })
  const result = {
    token: "t", coverage: 0, supported_coverage: 100, diff: [{ section: "Skills", before: "A", after: "B" }],
    quality: resumeQuality({ matched: 0, total: 8, missing: ["siem"], partial: false }),
    unverified_added_keywords: [], quality_blockers: m.roleQualityBlockers(live, {}),
  }
  assert.ok(acc.whatsappResumeRejectionReasons(result).includes("jd_coverage_below_floor"))
})

test("WhatsApp rejection log names why the floor placed nothing (counts only)", () => {
  const r = src("src/app/api/whatsapp/webhook/route.ts")
  for (const f of ["placedFromJd:", "unplacedReason:", "bulletsReverted:", "cached:"]) assert.ok(r.includes(f), f)
})
