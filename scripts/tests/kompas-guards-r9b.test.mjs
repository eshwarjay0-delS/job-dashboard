// Guards r9b (29 Oct 2026): Lens contract v3 (displayOpener / isSafeDisplay). Offline, code-level only.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { execFileSync } from "node:child_process"
import * as R from "../../src/lib/kompasSourceRetrieval.ts"
import * as G from "../../src/lib/kompasSentenceGate.ts"
import { allowedNumbers, questionFigures, speakFacts } from "../../src/lib/kompasGuards.ts"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const DOCS = R.sourceDocs({ resume: S.resume, jd: S.jd, documents: S.documents })
const allowed = allowedNumbers(S.resume, S.documents)
const facts = speakFacts({ resume: S.resume, jd: "", documents: S.documents, heard: "", identity: "", projects: "" })
const Q = "Tell me about a time you led a migration."
const passages = R.retrievePassages(Q, DOCS, 4).passages
const check = G.sentenceCheck({ facts, allowed, asked: questionFigures(Q), docs: DOCS, question: Q, passages })
const bullet = "Built Splunk detections for AWS CloudTrail and GuardDuty findings and cut alert triage time by 40%."
const opP = G.splitOpenerPassages(DOCS)
const pid = opP.find((p) => p.line === bullet || p.text === bullet)?.id
const L0 = "In one of my roles, I "
const op = { text: bullet, sourceId: pid, sourceDoc: "resume", category: "experience-story", verbatim: true, leadIn: L0 }
const shown = L0 + "built" + bullet.slice(5)
const nums = (s) => (s.match(/\d[\d,.%]*/g) || [])
const caps = (s) => (s.match(/\b[A-Z][A-Za-z0-9]+\b/g) || []).filter((w) => !/^(?:In|I|My)$/.test(w))

test("v3: the gate shows displayOpener (first letter lowercased) and withOpener gets the same string", () => {
  assert.ok(pid, "fixture bullet is a session passage")
  assert.equal(G.displayOpenerText(op), shown)
  assert.equal(G.isSafeDisplayText(op, shown), true)
  const g = G.createSentenceGate({ check, opener: op, sourcePassages: opP })
  assert.deepEqual(g.start(), [shown]); assert.equal(g.openerText(), shown)
  assert.equal(G.withOpener("Then I tuned the noisy rules.", g.openerText()), `${shown} Then I tuned the noisy rules.`)
})
test("v3: acronym / inner-capital first words keep their capital", () => {
  assert.equal(G.displayOpenerText({ text: "AWS GuardDuty tuning.", leadIn: "In my work, I " }), "In my work, I AWS GuardDuty tuning.")
  assert.equal(G.displayOpenerText({ text: "SailPoint rollout.", leadIn: "In my work, I " }), "In my work, I SailPoint rollout.")
  assert.equal(G.displayOpenerText({ text: "Built X.", leadIn: "" }), "Built X.")
})
test("v3: approval stays on exact text; changed text, lead-in in text, display string as text, mismatched id never approve", () => {
  assert.equal(G.approveSourcedOpener(op, opP), true)
  for (const bad of [{ ...op, text: bullet.replace("40%", "45%") }, { ...op, text: L0 + bullet }, { ...op, text: shown },
    { ...op, sourceId: "dossier-item-7" }, { ...op, sourceId: opP.find((p) => p.id !== pid).id }]) {
    assert.equal(G.approveSourcedOpener(bad, opP), false, JSON.stringify(bad).slice(0, 80))
    assert.deepEqual(G.createSentenceGate({ check, opener: bad, sourcePassages: opP }).start(), [])
  }
})
test("v3: an unsafe display falls back to text (unknown lead-in, tampered display)", () => {
  const g = G.createSentenceGate({ check, opener: { ...op, leadIn: "At Globex in 2015 I led 50 people and " }, sourcePassages: opP })
  assert.deepEqual(g.start(), [bullet]); assert.equal(g.openerText(), bullet)
  assert.equal(G.isSafeDisplayText(op, shown.replace("40%", "60%")), false)
  assert.equal(G.isSafeDisplayText(op, L0 + bullet.toLowerCase()), false)
  assert.equal(G.isSafeDisplayText(op, bullet), false)
  assert.equal(G.isSafeDisplayText(null, shown), false)
})
test("v3: the display never alters facts, numbers, dates or names, for every lead-in", () => {
  for (const l of G.LEAD_INS.concat([""])) {
    const o = { ...op, leadIn: l }, d = G.displayOpenerText(o)
    assert.equal(G.isSafeDisplayText(o, d), true, l)
    assert.deepEqual(nums(d), nums(bullet)); assert.deepEqual(caps(d).filter((w) => w !== "Built"), caps(bullet).filter((w) => w !== "Built"))
    assert.equal(d.slice(l.length + 1), bullet.slice(1)); assert.doesNotMatch(l, /\d/)
    assert.deepEqual(R.extractClaims(l + "x."), [], l)
  }
})

// ---- LEAD_INS must equal Lens's list, read from Lens's bundle (no hand copy)
const BUNDLE = process.env.KOMPAS_LENS_BUNDLE || "/workspace/kompas-lens-r6.bundle"
const LENS_REPO = process.env.KOMPAS_LENS_PREREQ || "/workspace/lens-work"
function lensLeadIns() {
  if (!existsSync(BUNDLE) || !existsSync(LENS_REPO)) return null
  const dir = execFileSync("mktemp", ["-d"]).toString().trim()
  try {
    const git = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: ["ignore", "pipe", "pipe"] }).toString()
    git("init", "-q"); git("fetch", "-q", LENS_REPO, "+refs/heads/*:refs/remotes/p/*")
    git("fetch", "-q", BUNDLE, "+refs/heads/lens-r1:refs/remotes/b/lens")
    const src = git("show", "refs/remotes/b/lens:src/lib/kompasOpener.ts")
    const m = src.match(/export const LEAD_INS[^=]*=\s*(\[[^\]]*\])/)
    return m ? JSON.parse(m[1]) : undefined
  } finally { execFileSync("rm", ["-rf", dir]) }
}
const lens = lensLeadIns()
test("LEAD_INS copy equals Lens's list in the bundle", { skip: lens === null ? `SKIPPED (not a pass): Lens bundle ${BUNDLE} or prerequisite repo ${LENS_REPO} absent` : false }, () => {
  assert.ok(Array.isArray(lens), "LEAD_INS not found in Lens's kompasOpener.ts")
  assert.deepEqual([...G.LEAD_INS], lens)
})
