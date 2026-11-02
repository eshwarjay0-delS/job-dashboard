import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const dossierSource = readFileSync(new URL("../../src/lib/kompas-dossier-bots.ts", import.meta.url), "utf8")
const audienceSource = readFileSync(new URL("../../src/lib/kompasAudience.ts", import.meta.url), "utf8")
const serviceSource = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(dossierSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
}}).outputText
const module = { exports: {} }
vm.runInNewContext(compiled, { module, exports: module.exports, require, console })
const { buildDualDossierPlan } = module.exports

const metricPolicy = /METRIC EVIDENCE LEDGER: Every personal achieved number requires/
const noPromote = /job-description target.*prior AI|job description supplies expectations, not experience/i
const records = [
  ["endpoint analyst", "SLA result", "handled CyberArk EPM policies but no counted tickets"],
  ["SOC analyst", "false positive rate", "reviewed security alerts with no measured alert classification"],
  ["security engineer", "MTTR", "examined logs with no restoration timestamp cohort"],
  ["IAM analyst", "access review", "reviewed permissions without measured revocation percentage"],
  ["cloud engineer", "availability", "supported cloud changes without measured availability data"],
  ["network analyst", "DNS outage", "investigated routing with no verified downtime duration"],
  ["GRC analyst", "issue closure", "tracked remediation but no reconciled closure denominator"],
  ["desktop support", "ticket volume", "handled endpoint incidents without ticket-count evidence"],
  ["appsec engineer", "vulnerability reduction", "ran assessment but no validated before-after exposure"],
  ["data analyst", "performance gain", "built queries without measurement baseline"],
  ["DevOps engineer", "pipeline time", "maintained CI with no job-duration comparison"],
  ["MES validator", "validation cycles", "reviewed controls without batch numbers"],
  ["Salesforce administrator", "workflow speed", "supported permissions without measured duration"],
  ["IT support", "service desk SLA", "investigated incidents but no confirmed SLA clock"],
  ["endpoint analyst", "EPM approval latency", "supported least privilege without timed approval records"],
  ["security analyst", "CrowdStrike alert rates", "reviewed EDR findings without an alert denominator"],
  ["endpoint analyst", "certificate recurrence", "resolved PKI-related issues without recurrence cohort"],
  ["network engineer", "packet loss", "analyzed captures but no validated loss percentage"],
  ["architect", "scalability gain", "documented system integration without throughput measurement"],
  ["incident responder", "containment time", "supported IR without timestamps for comparable events"],
]

test("live answer policy excludes JD numbers and model transcripts from achieved candidate metrics", () => {
  assert.match(audienceSource, /Metric provenance \(hard\)/i)
  assert.match(audienceSource, /job description, interviewer question, example, prior model answer/i)
  assert.match(audienceSource, /numerator, denominator, source and time window/i)
  assert.match(audienceSource, /Technical identifiers \(event IDs, protocol codes, versions and ports\)/i)
  assert.match(audienceSource, /a JD, question, prior AI answer, fictional scenario/i)
  assert.match(serviceSource, /\$\{EVIDENCE_POLICY\}/)
  assert.match(serviceSource, /sessionFacts\(resumeSrc, docsSrc\)/)
  assert.match(serviceSource, /Never invent a count, percentage, duration, before\\/after figure, or an unsupported qualitative result/)
  assert.doesNotMatch(serviceSource, /cut the queue to something the team could clear by lunch/)
})

test("all dossier intelligence stages require outcome metric provenance", () => {
  const sample = [
    { id: "r", kind: "resume", title: "Resume", text: "Handled endpoint issues. No percent or volume supplied." },
    { id: "j", kind: "job_description", title: "JD", text: "Must improve resolution by 95%." },
    { id: "c", kind: "chat_transcript", title: "Prior AI", text: "I delivered a 75% reduction. This is a generated practice statement." },
  ]
  const p = buildDualDossierPlan(sample)
  for (const role of [p.notebook, p.dossier, p.synthesis("teaching", "analysis")]) {
    assert.match(role.system, metricPolicy)
    assert.match(role.system, /source ID and digest/)
    assert.match(role.system, /numerator\/denominator/)
    assert.match(role.system, noPromote)
    assert.match(role.system, /qualitative evidence card/)
    assert.match(role.user, /95%/)
    assert.match(role.user, /75%/)
  }
})

test("20 different job families cannot turn a numeric JD target into a sourced achievement instruction", () => {
  assert.equal(records.length, 20)
  for (const [role, metric, claimedWork] of records) {
    const src = [
      { id: "resume", kind: "resume", title: role, text: claimedWork + "; no metric." },
      { id: "jd", kind: "job_description", title: "Role " + role, text: "Role target: 98% " + metric },
      { id: "historical", kind: "interview_transcript", title: "AI rehearsal", text: "I improved " + metric + " by 48% in a fabricated demonstration." },
    ]
    const p = buildDualDossierPlan(src)
    for (const stage of [p.notebook, p.dossier, p.synthesis("a", "b")]) {
      assert.ok(stage.user.includes("98% " + metric))
      assert.match(stage.system, /Every personal achieved number requires/)
      assert.match(stage.system, /job-description target/i)
      assert.match(stage.system, /model-generated interview response/i)
      assert.match(stage.system, /never say it was independently measured/i)
    }
  }
})

test("technical constants are not mistaken for personal performance outcomes", () => {
  const p = buildDualDossierPlan([
    { id: "resume", kind: "resume", title: "Candidate", text: "Worked with Kerberos and endpoint policy." },
    { id: "jd", kind: "job_description", title: "Job", text: "Know event 4625, HTTP 403, TLS and CyberArk EPM." },
  ])
  assert.match(p.notebook.system, /Windows event IDs, HTTP statuses, ports, CVE identifiers and software versions/)
  assert.match(audienceSource, /Technical identifiers/)
})
