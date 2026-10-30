// MFit resume tailoring batch, 30 Oct 2026 (resume-coverage tailoring blueprint, section 4 items 1-5).
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
const src = rel => readFileSync(resolve(root, rel), "utf8").replace(/\r\n/g, "\n")
function load(rel, env) {
  const compiled = ts.transpileModule(src(rel), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  const ctx = { exports, module: { exports }, require }
  if (env) ctx.process = { env }
  vm.runInNewContext(compiled, ctx, { filename: rel })
  return exports
}
const { resumeQuality } = load("src/lib/resume-quality.ts")
const on = load("src/lib/whatsapp-resume-acceptance.ts")
const off = load("src/lib/whatsapp-resume-acceptance.ts", { TAILOR_DELIVER_WITH_SHORTFALL: "0" })
const gateOff = load("src/lib/whatsapp-resume-acceptance.ts", { JD_TERMS_ALWAYS_ON_SKILLS: "0" })
const guards = load("src/lib/tailor-guards.ts")
const guardsOff = load("src/lib/tailor-guards.ts", { TAILOR_CACHE_SKIP_REFUSED: "0", TAILOR_WEB_ROUND_TRIP: "off", TAILOR_WEB_SHARED_CLAIM: "false" })

// 27 of 32 job-post terms: 84.375%, reported as 84.3 (coveragePercent truncates).
const short = (changes = {}) => ({
  token: "t", coverage: 84.3, supported_coverage: 100, diff: [{ section: "Skills", before: "A", after: "B" }],
  quality: resumeQuality({ matched: 27, total: 32, missing: ["kafka", "terraform", "gcp iam", "row-level security", "f5"], partial: false }),
  unverified_added_keywords: [], quality_blockers: [], ...changes,
})

test("item 2: a complete file under 95% is delivered with the shortfall listed (switch on, default)", () => {
  assert.equal(short().quality.status, "needs_review")
  assert.equal(on.whatsappResumeRejectionReasons(short()).length, 0, on.whatsappResumeRejectionReasons(short()).join(","))
  assert.equal(on.acceptableWhatsAppResume(short()), true)
  assert.equal(on.deliveredWithShortfall(short()), true)
})
test("item 2: switch off or job-post terms switch off restores the 95% refusal", () => {
  assert.ok(off.whatsappResumeRejectionReasons(short()).includes("jd_coverage_below_floor"))
  assert.equal(off.acceptableWhatsAppResume(short()), false)
  assert.ok(gateOff.whatsappResumeRejectionReasons(short()).includes("jd_coverage_below_floor"))
})
test("item 2: only the coverage shortfall is excused; anything incomplete or unsupported is still refused", () => {
  for (const bad of [
    { partial: { failed: 1, total: 5 } }, { skills_only: true }, { quality_blockers: ["roles_unrewritten"] },
    { unverified_added_keywords: ["Kafka"] }, { supported_coverage: 90 }, { unchanged: true, diff: [] },
    { quality: { ...short().quality, incomplete: true } }, { coverage: undefined },
  ]) assert.equal(on.acceptableWhatsAppResume(short(bad)), false, JSON.stringify(bad))
})
test("item 2: 95% and above is unchanged", () => {
  const met = short({ coverage: 100, quality: resumeQuality({ matched: 13, total: 13, missing: [], partial: false }) })
  assert.equal(on.deliveredWithShortfall(met), false)
  assert.equal(on.acceptableWhatsAppResume(met), true)
})
test("item 2: the WhatsApp reply names the shortfall and a below-target file gets one fresh pass first", () => {
  const route = src("src/app/api/whatsapp/webhook/route.ts")
  assert.ok(route.includes("Below the 95% target ("))
  assert.ok(route.includes("const firstRejected = !acceptableWhatsAppResume(result) || belowTarget(result)"))
  assert.ok(route.includes("(fresh.coverage ?? 0) > (result.coverage ?? 0))) result = fresh"))
})

test("item 3: a refused stored run is not replayed; switch off restores replay", () => {
  assert.equal(guards.refusedForReplay({ quality_blockers: ["role_evidence_gaps"] }), true)
  assert.equal(guards.refusedForReplay({ unverified_added_keywords: ["kafka"] }), true)
  assert.equal(guards.refusedForReplay({ quality_blockers: [], unverified_added_keywords: [] }), false)
  assert.equal(guards.cacheSkipRefusedOn(), true)
  assert.equal(guardsOff.cacheSkipRefusedOn(), false)
  const tailor = src("src/lib/tailor.ts")
  assert.ok(tailor.includes(`if (cacheSkipRefusedOn() && refusedForReplay(cached)) throw new Error("refused result")`))
})

function fakeStore() {
  const m = new Map()
  return {
    m,
    async putIfAbsent(k, v) { if (m.has(k)) return false; m.set(k, v); return true },
    async getText(k) { return m.has(k) ? m.get(k) : null },
    async put(k, v) { m.set(k, v) },
    async delete(k) { m.delete(k) },
  }
}
test("item 4: one website run per request across instances (shared claim)", async () => {
  const s = fakeStore()
  const key = guards.webClaimKey("user-1", "Job post text", { filepath: "/r/a.docx" })
  assert.match(key, /^tailor\/web-claims\/[0-9a-f]{24}$/)
  assert.ok(!key.includes("user-1") && !key.includes("Job post"))
  assert.notEqual(key, guards.webClaimKey("user-2", "Job post text", { filepath: "/r/a.docx" }))
  assert.notEqual(key, guards.webClaimKey("user-1", "Job post text", { filepath: "/r/a.docx", noCache: true }))
  assert.equal(key, guards.webClaimKey("user-1", "  Job post text ", { filepath: "/r/a.docx" }))
  assert.equal(await guards.takeClaim(s, key, "A"), "ok")
  assert.equal(await guards.takeClaim(s, key, "B"), "held")
  await guards.releaseClaim(s, key, "B") // not ours: kept
  assert.ok(s.m.has(key))
  await guards.releaseClaim(s, key, "A")
  assert.equal(s.m.has(key), false)
  assert.equal(await guards.takeClaim(s, key, "B"), "ok")
})
test("item 4: a stale claim is taken over, a wait ends on release or times out, storage trouble never blocks", async () => {
  const s = fakeStore()
  let t = 1_000_000
  const now = () => t
  s.m.set("k", JSON.stringify({ at: t - 301_000, token: "old" }))
  assert.equal(await guards.takeClaim(s, "k", "new", now), "ok")
  s.m.set("k", JSON.stringify({ at: t, token: "other" }))
  let slept = 0
  const sleepRelease = async () => { slept++; if (slept === 3) s.m.delete("k"); t += 2000 }
  assert.equal(await guards.waitForClaim(s, "k", 60_000, 2000, now, sleepRelease), true)
  s.m.set("k", JSON.stringify({ at: t, token: "other" }))
  assert.equal(await guards.waitForClaim(s, "k", 10_000, 2000, now, async () => { t += 2000 }), false)
  const broken = { putIfAbsent: async () => { throw new Error("down") }, getText: async () => null, put: async () => {}, delete: async () => {} }
  assert.equal(await guards.takeClaim(broken, "k", "x"), "off")
  assert.equal(guards.webSharedClaimOn(), true)
  assert.equal(guardsOff.webSharedClaimOn(), false)
})
test("item 4: the website route claims, waits, serves the stored result and releases", () => {
  const route = src("src/app/api/tailor/route.ts")
  for (const part of ["webSharedClaimOn() ? webClaimKey(", "await takeClaim(blob, claimKey, claimToken)", "await waitForClaim(blob, claimKey, CLAIM_WAIT_MS)",
    "noCache = false", "if (claimed) await releaseClaim(blob, claimKey, claimToken)", "status: 409"]) assert.ok(route.includes(part), part)
})

test("item 1: the website runs the WhatsApp round-trip check before handing a file over or charging", () => {
  const route = src("src/app/api/tailor/route.ts")
  assert.ok(route.includes("return sameResumeIdentity(a, b)"))
  assert.ok(route.includes("if (webRoundTripOn() && !result.unchanged && !(await sameFactsAsSource(result)))"))
  assert.ok(route.indexOf("sameFactsAsSource(result)))") < route.indexOf("deductPoints("), "checked before points are deducted")
  assert.ok(route.indexOf("sameFactsAsSource(result)))") < route.indexOf("await fileTailored("), "checked before the file is saved")
  assert.ok(route.includes(`quality_blockers: ["identity_mismatch"] }, { status: 422 }`))
  assert.equal(guards.webRoundTripOn(), true)
  assert.equal(guardsOff.webRoundTripOn(), false)
})
test("item 1: the round-trip guard it calls stops a changed name, phone or date", () => {
  const rt = src("src/lib/resume-identity.ts")
  assert.ok(rt.includes("checkRoundTrip(source, output)"))
})

test("item 5: terms the AI writer put on the skills line are named in the result and the reply", () => {
  const tailor = src("src/lib/tailor.ts")
  assert.ok(tailor.includes("skills_from_jd_writer?: string[]"))
  assert.ok(tailor.includes("...(writerOnSkills.length ? { skills_from_jd_writer: writerOnSkills } : {}),"))
  assert.ok(tailor.includes("const writerOnSkills = jdGate && !refine"))
  const route = src("src/app/api/whatsapp/webhook/route.ts")
  assert.ok(route.includes("...(result.skills_from_jd_writer || [])"))
})
