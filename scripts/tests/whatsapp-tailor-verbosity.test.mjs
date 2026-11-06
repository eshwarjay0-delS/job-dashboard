// WhatsApp tailor verbosity and the Salesforce Security Specialist overlap.
// A thin rewrite that drops the source tools fails the grounding check.
// A professional Salesforce security resume clears the 70% job-post floor.
// A junk resume against the same post does not.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath, pathToFileURL } from "node:url"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = fileURLToPath(new URL("../..", import.meta.url))
function load(rel) {
  const source = readFileSync(path.join(root, rel), "utf8")
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, require }, { filename: rel })
  return exports
}
const verbosity = load("src/lib/resume-verbosity.ts")
const claude = readFileSync(path.join(root, "src/lib/claude.ts"), "utf8")
const tailor = readFileSync(path.join(root, "src/lib/tailor.ts"), "utf8")

const sourceBullet = "Administered Okta and SailPoint IdentityIQ for SOX access reviews and built Splunk dashboards for privileged monitoring."
const thin = "Managed security operations for the bank."
const full = "Administered Okta and SailPoint IdentityIQ for SOX access reviews and built Splunk dashboards for privileged monitoring across the bank's identity systems."

test("a thin bullet drops the source tools and a complete bullet keeps them", () => {
  const dropped = verbosity.droppedGrounding(sourceBullet, thin)
  for (const token of ["okta", "sailpoint", "identityiq", "splunk"]) assert.ok(dropped.includes(token), dropped.join(","))
  assert.deepEqual([...verbosity.droppedGrounding(sourceBullet, full)], [])
})

test("full mode keeps a longer grounded summary and one-page mode stays short", () => {
  assert.equal(verbosity.summaryWordCap({}), 140)
  assert.equal(verbosity.summaryWordCap({ onePage: true }), 55)
  assert.equal(verbosity.summaryWordCap({ quick: true }), 80)
  assert.equal(verbosity.FULL_SUMMARY_WORDS, 140)
  assert.match(verbosity.FULL_EXPERIENCE_DEPTH, /Do not shorten a detailed bullet/)
  assert.match(verbosity.FULL_EXPERIENCE_DEPTH, /Do not invent employers, dates, metrics/)
  assert.match(verbosity.FULL_EXPERIENCE_DEPTH, /Do not add address, visa, relocation/)
  assert.match(claude, /FULL_EXPERIENCE_DEPTH/)
  assert.match(claude, /summaryWordCap\(/)
  assert.match(tailor, /CACHE_GENERATION = "25"/)
})

const SALESFORCE = `Salesforce Security Specialist
Responsibilities:
- Administer Salesforce profiles, permission sets, and sharing rules.
- Configure field-level security and Salesforce Shield Platform Encryption.
- Monitor Salesforce Event Monitoring.
- Integrate single sign-on and multi-factor authentication with Okta and Azure AD.
- Run access reviews in SailPoint IdentityIQ and collect SOX audit evidence.
- Investigate privileged access alerts in Splunk.
Requirements:
- Salesforce security administration and identity and access management experience.`

const GOOD = `Salesforce Security Specialist with 9+ years in identity and access management.
TECHNICAL SKILLS
Salesforce: Salesforce profiles, permission sets, sharing rules, field-level security, Salesforce Shield Platform Encryption, Salesforce Event Monitoring
Identity: Okta, Azure AD, single sign-on, multi-factor authentication, SailPoint IdentityIQ, access reviews, SOX audit evidence
Security Operations: Splunk, privileged access alerts
PROFESSIONAL EXPERIENCE
Administered Salesforce profiles, permission sets, and sharing rules. Configured field-level security and Salesforce Shield Platform Encryption.
Monitored Salesforce Event Monitoring. Integrated single sign-on and multi-factor authentication with Okta and Azure AD.
Ran access reviews in SailPoint IdentityIQ and collected SOX audit evidence. Investigated privileged access alerts in Splunk.`

const JUNK = `Pastry chef. Baked sourdough, laminated dough, and seasonal tarts for a hotel kitchen. Managed a proofing schedule and a farmers market stall.`

test("Salesforce Security Specialist overlap clears 70% on a grounded resume and fails on junk", () => {
  const hooks = pathToFileURL(path.join(root, "scripts/tests/helpers/ts-alias-hooks.mjs")).href
  const made = pathToFileURL(path.join(root, "src/lib/made-floor.ts")).href
  const code = `const m = await import(${JSON.stringify(made)}); console.log(JSON.stringify([m.floorShare(process.argv[2], process.argv[1]), m.floorShare(process.argv[3], process.argv[1])]))`
  const cwd = mkdtempSync(path.join(os.tmpdir(), "mf-sf-"))
  try {
    const r = spawnSync(process.execPath, ["--experimental-transform-types", "--no-warnings", "--import", hooks, "--input-type=module", "-e", code, SALESFORCE, GOOD, JUNK], {
      cwd, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PROJECT_DIR: root }, encoding: "utf8", timeout: 60000,
    })
    const line = (r.stdout || "").trim().split(/\r?\n/).pop()
    assert.ok(line && line.startsWith("["), (r.stderr || "").slice(-800))
    const [good, junk] = JSON.parse(line)
    assert.ok(good >= 0.7, `grounded Salesforce resume share ${good}`)
    assert.ok(junk < 0.7, `junk resume share ${junk}`)
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})
