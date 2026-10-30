// Guards r9 (29 Oct 2026): offline, code-level only; not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import * as R from "../../src/lib/kompasSourceRetrieval.ts"
import * as G from "../../src/lib/kompasSentenceGate.ts"
import { allowedNumbers, applyGuards, needsGuard, questionFigures, speakFacts } from "../../src/lib/kompasGuards.ts"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const RES = `${S.resume}
- Managed 4 analysts and covered 3 regions; the migration took 12 weeks and saved $2 million.
- Mapped controls to ISO 27001, SOC 2 Type II, NIST 800-53 and PCI DSS 4.0 for a 24/7 SOC on Windows Server 2019.`
const DOCS = R.sourceDocs({ resume: RES, jd: S.jd, documents: S.documents })
const allowed = allowedNumbers(RES, S.documents)
const facts = speakFacts({ resume: RES, jd: "", documents: S.documents, heard: "", identity: "", projects: "" })
const Q = "Tell me about a time you led a migration."
const passages = R.retrievePassages(Q, DOCS, 4).passages
const check = G.sentenceCheck({ facts, allowed, asked: questionFigures(Q), docs: DOCS, question: Q, passages })
const sourceFlags = (s) => R.unsupportedClaims(s, passages, DOCS, Q)

// ---- 1. number guard: number + unit/noun
const INVENTED = [
  "I led the migration in 4 weeks.", "I secured 4 regions for the bank.", "We covered 4 regions.", "The rollout took 3-5 weeks.",
  "It was a 4-week rollout that I led.", "I managed 12 analysts on it.", "I cut alerts by 40% across 12 regions.",
  "It protected 2 million users.", "I managed 3 engineers in 4 regions.", "I saved $4 million.", "I reduced costs by 4%.",
  "The rollout took 3 to 5 weeks.", "I cut triage time by 40 percent in 4 weeks.",
]
for (const s of INVENTED) test(`invented figure is unsupported: ${s}`, () => {
  assert.equal(check(s), false, "sentence gate must stop it")
  assert.ok(sourceFlags(s).length > 0, `source check must flag it: ${JSON.stringify(sourceFlags(s))}`)
})
test("needsGuard: a bare source number no longer backs a different unit", () => {
  assert.equal(needsGuard("I led it in 4 weeks.", allowed), true)
  assert.equal(needsGuard("I led 4 regions.", allowed), true)
  assert.equal(needsGuard("I managed 4 analysts.", allowed), false)
})
test("applyGuards rewrites the invented duration but keeps the sourced count", () => {
  const out = applyGuards("I managed 4 analysts and led the migration in 4 weeks.", facts, allowed).text
  assert.match(out, /4 analysts/)
  assert.doesNotMatch(out, /4 weeks/)
  const r = applyGuards("I led the migration over 3-5 weeks.", facts, allowed).text
  assert.doesNotMatch(r, /\d/)
  assert.doesNotMatch(r, /several-several|several to several/)
})
const SUPPORTED = [
  "I managed 4 analysts.", "I covered 3 regions.", "The migration took 12 weeks.", "It saved $2 million.",
  "I cut alert triage time by 40%.", "I ran access reviews for 1,200 privileged accounts.",
  "I mapped controls to ISO 27001, SOC 2 Type II, NIST 800-53 and PCI DSS 4.0 for a 24/7 SOC on Windows Server 2019.",
]
for (const s of SUPPORTED) test(`figure with the same meaning in the sources stays supported: ${s}`, () => {
  assert.equal(check(s), true, JSON.stringify(sourceFlags(s)))
  assert.equal(applyGuards(s, facts, allowed).text, s)
})
test("standard names stay untouched by the figures guard even with no sources", () => {
  const s = "I led the ISO 27001 and SOC 2 work, mapped NIST 800-53 and PCI DSS 4.0, and ran a 24/7 SOC on Windows Server 2019."
  assert.equal(applyGuards(s, null, new Set()).text, s)
})
test("the interviewer's own figure with its unit passes; the same number with another unit does not", () => {
  const q = "How would you run this across 5 regions?"
  const c = G.sentenceCheck({ facts, allowed, asked: questionFigures(q), docs: DOCS, question: q, passages })
  assert.equal(c("I would start with the 5 regions that carry the most risk."), true)
  assert.equal(c("I delivered it in 5 weeks."), false)
})
test("figure list for prompts holds no context keys", async () => {
  const F = await import("../../src/lib/kompasFigureContext.ts")
  assert.ok(F.hasContext(allowed))
  assert.ok(F.figureList(allowed).every((k) => !k.startsWith("\u0001")))
  assert.ok(F.figureList(allowed).includes("40%"))
})

// ---- 2. sentence-initial common words are not names
const CLEAN_OPENERS = ["Leadership sees it weekly.", "Failures go back to the owner.", "Ownership mattered most to me.",
  "Communication was the hard part.", "Accountability sat with the owner.", "Visibility improved for the business owner.",
  "Trust came from the weekly report.", "Consistency matters more than speed here."]
for (const s of CLEAN_OPENERS) test(`clean sentence opener is not a name: ${s}`, () => { assert.equal(check(s), true, JSON.stringify(sourceFlags(s))) })
const REAL_NAMES = ["Globex hired me to fix it.", "Datadog was the tool I used.", "Initech trusted me with the audit.", "Okta ran the sign-in.",
  "Acme Corp gave me the budget.", "Kubernetes ran every workload.", "Hooli promoted me twice."]
for (const s of REAL_NAMES) test(`real name at sentence start is still checked: ${s}`, () => {
  assert.equal(check(s), false); assert.ok(sourceFlags(s).length > 0)
})
test("a name that IS in the sources at sentence start stays supported", () => {
  assert.equal(check("Northwind Bank gave me the access review program."), true)
  assert.equal(check("Splunk was where I built the detections."), true)
})

// ---- 3. Lens opener wiring
const bullet = "Built Splunk detections for AWS CloudTrail and GuardDuty findings and cut alert triage time by 40%."
const opP = G.splitOpenerPassages(DOCS)
const pid = opP.find((p) => p.line === bullet || p.text === bullet)?.id
test("a verbatim resume bullet (no 'I') is an approved opener and passes the sentence check", () => {
  assert.ok(pid)
  const op = { text: bullet, sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true }
  assert.equal(G.approveSourcedOpener(op, opP), true)
  assert.equal(check(bullet), true)
})
test("opener approval: exact match to its cited source only", () => {
  const base = { sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true }
  assert.equal(G.approveSourcedOpener({ ...base, text: bullet.replace("40%", "45%") }, opP), false)
  assert.equal(G.approveSourcedOpener({ ...base, text: bullet, verbatim: false }, opP), false)
  assert.equal(G.approveSourcedOpener({ ...base, text: bullet, sourceDoc: "jd" }, opP), false)
  assert.equal(G.approveSourcedOpener({ ...base, text: bullet, sourceId: "nope" }, opP), false)
  assert.equal(G.approveSourcedOpener({ ...base, text: bullet, category: "" }, opP), false)
})
test("withoutOpenerRepeat drops body sentences that restate the opener, never adds", () => {
  const op = { text: bullet, sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true }
  const body = "I built Splunk detections for CloudTrail and GuardDuty findings and cut triage time by 40%. Then I tuned the noisy rules with the owners."
  const out = G.withoutOpenerRepeat(body, op)
  assert.equal(out, "Then I tuned the noisy rules with the owners.")
  assert.equal(G.withoutOpenerRepeat(body, null), body)
  assert.ok(out.length <= body.length)
})
test("sentence gate drops a repeat of the opener without stopping the stream", () => {
  const op = { text: bullet, sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true }
  const g = G.createSentenceGate({ check, opener: op, sourcePassages: opP })
  assert.deepEqual(g.start(), [bullet])
  const got = g.push("I built Splunk detections for CloudTrail and GuardDuty findings and cut triage time by 40%. Then I tuned the noisy rules with the owners. ")
  assert.deepEqual(got, ["Then I tuned the noisy rules with the owners."])
  assert.equal(g.halted(), false)
  assert.equal(G.withOpener("I built Splunk detections for CloudTrail and GuardDuty findings and cut triage time by 40%. Then I tuned it.", bullet), `${bullet} Then I tuned it.`)
})
test("pickOpener wiring: Lens-shaped table + pick; empty category gives nothing; failures give nothing", () => {
  const items = [{ id: pid, sourceDoc: "resume", category: "experience-story", text: bullet, status: "sourced" },
    { id: "jd1", sourceDoc: "jd", category: "experience-story", text: "Own detection engineering.", status: "sourced" },
    { id: "h1", sourceDoc: "resume", category: "introduction", text: "", status: "hole" }]
  const W = G.contractOpenerTable(items, { resume: RES })
  assert.equal(W.table["experience-story"].length, 1)
  assert.equal(W.refused.length, 2)
  const prov = G.lensOpenerProvider({ table: () => W.table, pick: G.contractPickOpener })
  G.setSourcedOpenerProvider(prov)
  try {
    const op = G.sourcedOpenerFor("Tell me about a time you built detections.", DOCS)
    assert.ok(op && op.verbatim === true && op.text === bullet && op.sourceId === pid && op.sourceDoc === "resume")
    assert.equal(G.sourcedOpenerFor("Introduce yourself.", DOCS), null, "empty category")
    assert.equal(G.sourcedOpenerFor("What is a SIEM?", DOCS), null, "not personal")
    G.setSourcedOpenerProvider(G.lensOpenerProvider({ table: () => { throw new Error("x") }, pick: G.contractPickOpener }))
    assert.equal(G.sourcedOpenerFor("Tell me about a time you built detections.", DOCS), null)
    G.setSourcedOpenerProvider(G.lensOpenerProvider({ table: () => W.table, pick: () => ({ text: "I led a team of 50.", sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true }) }))
    const bad = G.sourcedOpenerFor("Tell me about a time you built detections.", DOCS)
    assert.equal(G.approveSourcedOpener(bad, opP), false, "provider output still needs the exact-match approval")
  } finally { G.setSourcedOpenerProvider(null) }
})

// ---- 3b. Lens contract v2: leadIn + text
test("v2: approval compares text only; a lead-in folded into text fails; changed text or a non-session id fails", () => {
  const base = { sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true }
  assert.equal(G.approveSourcedOpener({ ...base, text: bullet, leadIn: "In one of my roles, I " }, opP), true)
  assert.equal(G.approveSourcedOpener({ ...base, text: "In one of my roles, I " + bullet, leadIn: "" }, opP), false)
  assert.equal(G.approveSourcedOpener({ ...base, text: bullet.replace("Splunk", "Datadog"), leadIn: "In my work, I " }, opP), false)
  assert.equal(G.approveSourcedOpener({ ...base, sourceId: "dossier-item-7", text: bullet, leadIn: "In my work, I " }, opP), false)
  const other = opP.find((p) => p.id !== pid && p.proves === "experience")
  assert.equal(G.approveSourcedOpener({ ...base, sourceId: other.id, text: bullet }, opP), false, "id of another passage")
})
test("v2: gate shows leadIn + text and withOpener gets the same string; unknown lead-in is dropped", () => {
  const op = { text: bullet, sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true, leadIn: "In one of my roles, I " }
  const g = G.createSentenceGate({ check, opener: op, sourcePassages: opP })
  // r9b: superseded by contract v3 — the shown form is displayOpener (first letter lowercased), see kompas-guards-r9b.test.mjs
  const spoken = "In one of my roles, I b" + bullet.slice(1)
  assert.deepEqual(g.start(), [spoken]); assert.equal(g.openerText(), spoken)
  assert.equal(G.withOpener("Then I tuned the noisy rules.", g.openerText()), `${spoken} Then I tuned the noisy rules.`)
  assert.equal(G.withOpener(`${spoken} Then I tuned it.`, g.openerText()), `${spoken} Then I tuned it.`)
  const bad = G.createSentenceGate({ check, opener: { ...op, leadIn: "At Globex in 2015 I led 50 people and " }, sourcePassages: opP })
  assert.deepEqual(bad.start(), [bullet])
  const badId = G.createSentenceGate({ check, opener: { ...op, sourceId: "R9" }, sourcePassages: opP })
  assert.deepEqual(badId.start(), [])
})
test("v2: no lead-in adds a fact, number or date; the spoken opener keeps the bullet's figures exactly", () => {
  for (const l of G.LEAD_INS) {
    assert.doesNotMatch(l, /\d/); assert.deepEqual(R.extractClaims(l + "x."), [], l)
    const spoken = G.spokenOpenerText({ text: bullet, leadIn: l })
    assert.ok(spoken.endsWith(bullet))
    assert.deepEqual(spoken.match(/\d[\d,.%]*/g), bullet.match(/\d[\d,.%]*/g))
    assert.equal(check(spoken), true, spoken)
  }
})
